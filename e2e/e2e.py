"""
Browser end-to-end test (Playwright for Python) against the local dev stack.
Start the backend with console emails and log to a file, and the frontend:
  (cd backend && EMAIL_PROVIDER=console NODE_ENV=development node server.js > /tmp/backend.log 2>&1 &)
  ./scripts/frontend.sh dev &
  pip install playwright && playwright install chromium
  python e2e/e2e.py            # screenshots + prescription PDF land in e2e/shots/, test users are removed at the end
"""
import glob, os, re, subprocess, sys, time, json
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:5173'
EXE = (glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium-*/*/chrome')) or [None])[0]
STAMP = str(int(time.time()))[-6:]
DOC_EMAIL = f'dr.e2e{STAMP}@autotest.wbfmh.local'
PAT_EMAIL = f'pat.e2e{STAMP}@autotest.wbfmh.local'
PW = 'Test@12345'
errors = []

def shot(page, name):
    page.wait_for_timeout(700)
    page.screenshot(path=f'' + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots') + '/{name}.png', full_page=False)

def solve_captcha(page):
    page.wait_for_function("document.querySelector('canvas[data-captcha-id]')?.dataset.captchaId?.length > 10")
    cid = page.eval_on_selector('canvas[data-captcha-id]', 'c => c.dataset.captchaId')
    out = subprocess.run(['node', '' + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'solve-captcha.mjs') + '', cid], capture_output=True, text=True)
    assert 'updated 1' in out.stdout, out.stdout + out.stderr
    page.fill('.cap-input', 'ABCDE')

def wait_msg(page, kind, text=None):
    loc = page.locator(f'.mb-toast[data-type="{kind}"]')
    if text: loc = loc.filter(has_text=text)
    loc.first.wait_for(timeout=15000)
    return loc.first.inner_text()

def login(page, email, pw):
    page.goto(f'{BASE}/login')
    page.fill('#login-email', email)
    page.fill('#login-password', pw)
    solve_captcha(page)
    page.click('button[type=submit]')
    wait_msg(page, 'success', 'Welcome')

def logout(page):
    page.click('.hdr-logout')
    page.wait_for_url('**/login')

def latest_otp(email):
    for _ in range(30):
        log = open(os.environ.get('BACKEND_LOG', '/tmp/backend.log')).read()
        m = re.findall(rf'\[email:console\] -> {re.escape(email)} \|[^\n]*?(\d{{6}})', log)
        if m: return m[-1]
        time.sleep(0.5)
    raise RuntimeError('OTP not found')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, timezone_id='Asia/Kolkata')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text[:120]} @ {page.url} :: {m.location}') if m.type == 'error' else None)

    errors.append('--- step 1 deep link while logged out')
    # 1. deep link while logged out
    page.goto(f'{BASE}/doctor/appointments')
    page.wait_for_url('**/login')
    assert 'Please login to continue' in page.inner_text('.login-deeplink')
    shot(page, '01-login-deeplink')

    errors.append('--- step 2 admin login')
    # 2. admin login
    login(page, 'wbffmh@gmail.com', 'Admin@12345')
    page.wait_for_url('**/admin/add-doctor')
    shot(page, '02-admin-add-doctor')

    errors.append('--- step 3 add doctor, available every day 00:00 - 24:00')
    # 3. add doctor, available every day 00:00 - 24:00
    page.fill('#doc-name', f'Dr. E2E Test {STAMP}')
    page.select_option('#doc-sex', 'Female')
    page.fill('#doc-spec', 'Psychiatrist')
    page.fill('#doc-email', DOC_EMAIL)
    page.fill('#doc-password', PW)
    page.fill('#doc-confirm', PW)
    for d in [1, 2, 3, 4, 5, 6, 0]:
        page.check(f'[data-testid="day-{d}"] input[type=checkbox]')
    page.select_option('#start-1-0', '00:00')
    page.select_option('#end-1-0', '24:00')
    page.click('[data-testid="day-1"] .ae-link')  # copy to all
    shot(page, '03-admin-availability')
    page.click('.ad-submit button[type=submit]')
    print('add doctor:', wait_msg(page, 'success', 'added'))

    errors.append('--- step 4 doctor list')
    # 4. doctor list
    page.click('.hdr-burger')
    page.wait_for_timeout(400)
    shot(page, '04-nav-drawer')
    page.click('.nd-link:has-text("Doctor List")')
    page.wait_for_url('**/admin/doctors')
    page.fill('.pg-search input', STAMP)
    page.wait_for_timeout(500)
    shot(page, '05-doctor-list')
    logout(page)

    errors.append('--- step 5 register patient')
    # 5. register patient
    page.click('text=New patient? Register')
    page.wait_for_url('**/register')
    try:
        page.wait_for_selector('#reg-name', timeout=8000)
    except Exception:
        shot(page, 'FAIL-register'); print('URL', page.url); print(page.inner_html('.route-stage')[:1500]); raise
    page.fill('#reg-name', f'E2E Patient {STAMP}')
    page.select_option('#reg-sex', 'Male')
    page.click('#reg-dob')
    page.click('.dp-title-btn[aria-label="Choose year"]')
    page.click('[data-decade="1990"]')
    page.click('.dp-big:has-text("1994")')
    page.click('.dp-big:has-text("Mar")')
    page.click('[data-date="1994-03-15"]')
    page.fill('.otp-email input[type=email]', PAT_EMAIL)
    page.click('.otp-email button:has-text("Send OTP")')
    print('otp:', wait_msg(page, 'success', 'OTP sent'))
    shot(page, '06-register-otp-timer')
    page.fill('.otp-code', latest_otp(PAT_EMAIL))
    page.click('.otp-panel button:has-text("Verify")')
    wait_msg(page, 'success', 'verified')
    page.fill('#reg-phone', '+919830012345')
    page.fill('#reg-password', PW)
    page.fill('#reg-confirm', PW)
    solve_captcha(page)
    shot(page, '07-register-filled')
    page.click('.auth-form button[type=submit]')
    print('register:', wait_msg(page, 'success', 'Registration'))
    page.wait_for_url('**/login')

    errors.append('--- step 6 patient books today (late slot) + a future day')
    # 6. patient books today (late slot) + a future day
    login(page, PAT_EMAIL, PW)
    page.wait_for_url('**/patient/book')
    page.wait_for_function(f"[...document.querySelectorAll('#bk-doctor option')].some(o => o.textContent.includes('{STAMP}'))")
    val = page.eval_on_selector_all('#bk-doctor option', f"os => os.find(o => o.textContent.includes('{STAMP}')).value")
    page.select_option('#bk-doctor', val)
    page.click('#bk-date')
    page.locator('.dp-day:not([disabled])').first.click()
    page.wait_for_function("document.querySelectorAll('#bk-slot option').length > 1")
    opts = page.eval_on_selector_all('#bk-slot option:not([disabled])', 'o => o.map(x => x.value)')
    print('slots today:', opts[:4], len(opts))
    page.select_option('#bk-slot', opts[0])
    shot(page, '08-book-filled')
    page.click('.book-form button[type=submit]')
    print('book:', wait_msg(page, 'success', 'booked'))
    shot(page, '09-book-success')

    page.goto(f'{BASE}/patient/appointments')
    page.wait_for_selector('.appt-card')
    shot(page, '10-patient-appointments')
    page.click('.theme-toggle')
    shot(page, '11-light-theme')
    page.click('.theme-toggle')
    logout(page)

    errors.append('--- step 7 doctor: prescription')
    # 7. doctor: prescription
    login(page, DOC_EMAIL, PW)
    page.wait_for_url('**/doctor/prescription')
    page.wait_for_function("document.querySelectorAll('#rx-patient option').length > 1")
    page.select_option('#rx-patient', index=1)
    page.fill('#rx-search', 'paracetamol 500')
    page.wait_for_function("document.querySelectorAll('#rx-results option').length > 1", timeout=15000)
    page.select_option('#rx-results', index=1)
    print('medicine:', page.input_value('#rx-name'), '| dose:', page.input_value('#rx-dose'))
    page.click('.toggle-btn:has-text("Morning")')
    page.click('.toggle-btn:has-text("Night")')
    page.select_option('#rx-food', 'after_food')
    page.fill('#rx-instr', 'for 5 days')
    page.click('button:has-text("+ Add medicine")')
    page.fill('#rx-name', 'Test Syrup')
    print('syrup dose:', page.input_value('#rx-dose'))
    page.click('.toggle-btn:has-text("SOS")')
    page.select_option('#rx-food', 'with_food')
    page.click('button:has-text("+ Add medicine")')
    # signature
    c = page.locator('.sp-canvas').bounding_box()
    page.mouse.move(c['x'] + 30, c['y'] + 80); page.mouse.down()
    for i in range(20): page.mouse.move(c['x'] + 30 + i * 12, c['y'] + 80 + (15 if i % 2 else -15))
    page.mouse.up()
    page.click('button:has-text("Use drawn signature")')
    wait_msg(page, 'success', 'Signature')
    page.fill('#rx-notes', 'Sleep well, follow up after 2 weeks')
    shot(page, '12-prescription-form')
    page.click('button:has-text("Generate prescription")')
    print('prescription:', wait_msg(page, 'success', 'Prescription'))
    shot(page, '13-prescription-done')
    with page.expect_download() as dl:
        page.click('.rx-done button')
    path = f'' + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots') + '/prescription.pdf'
    dl.value.save_as(path)
    print('downloaded pdf')
    page.goto(f'{BASE}/doctor/appointments')
    page.wait_for_selector('.appt-card')
    shot(page, '14-doctor-appointments')

    # meeting page for the future appointment is not applicable; check mobile view
    page.set_viewport_size({'width': 390, 'height': 844})
    shot(page, '15-mobile')
    b.close()

subprocess.run(['node', 'src/db/cli.js', 'cleanup-test-data'], cwd=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'), env={**os.environ, 'NODE_ENV': 'development'})
print('ERRORS:', json.dumps(errors, indent=1))
