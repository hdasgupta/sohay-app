/**
 * One time helper that turns a Google OAuth client into the refresh token the
 * backend needs to upload consultation recordings to Google Drive.
 *
 *   node drive-auth.mjs                       # reads GOOGLE_CLIENT_ID / SECRET from .env
 *   node drive-auth.mjs ./client_secret.json  # reads them from the downloaded json
 *   PORT_OAUTH=53682 node drive-auth.mjs ...  # pick the loopback port
 *
 * It starts a tiny local server, opens a consent url that redirects back to it,
 * captures the code automatically and writes GOOGLE_CLIENT_ID,
 * GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN and GOOGLE_DRIVE_ENABLED=true into
 * backend/.env.
 *
 * Google no longer supports the copy-the-code (oob) flow: it answers
 * "Access blocked: This app's request is invalid". A loopback redirect is the
 * supported replacement. For a "Desktop app" client any loopback port is
 * accepted automatically; for a "Web application" client add the exact uri this
 * script prints to the client's Authorized redirect URIs first.
 *
 * Sign in as the account that should own the recordings
 * (GOOGLE_DRIVE_OWNER_EMAIL).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { google } from 'googleapis';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve(import.meta.dirname, '.env');
dotenv.config({ path: ENV_PATH });

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const PORT = Number(process.env.PORT_OAUTH || 53682);
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const readCredentials = () => {
  const jsonPath = process.argv[2];
  if (jsonPath) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));
    const block = raw.web || raw.installed;
    if (!block) throw new Error('The json has neither an "installed" nor a "web" block');
    return { clientId: block.client_id, clientSecret: block.client_secret, kind: raw.web ? 'web' : 'desktop' };
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Pass the client secret json path, or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    kind: 'env',
  };
};

const upsertEnv = (values) => {
  let content = fs.readFileSync(ENV_PATH, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    content = new RegExp(`^${key}=.*$`, 'm').test(content)
      ? content.replace(new RegExp(`^${key}=.*$`, 'm'), line)
      : `${content.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
  console.log(`[drive-auth] updated ${ENV_PATH}`);
};

const page = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>
   <body style="font-family:system-ui;background:#0b1220;color:#e2e8f3;display:flex;
   align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
   <div><h2 style="margin:0 0 10px">${title}</h2><p style="color:#93a4c0">${body}</p></div></body>`;

/** Waits on the loopback redirect and resolves with the authorization code. */
const waitForCode = () =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end('not found');
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (error || !code) {
        res.end(page('Authorisation failed', error || 'No code was returned'));
        server.close();
        reject(new Error(error || 'No code was returned'));
        return;
      }
      res.end(page('Authorisation complete', 'You can close this tab and go back to the terminal.'));
      server.close();
      resolve(code);
    });
    server.on('error', (error) =>
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `port ${PORT} is busy - rerun with PORT_OAUTH=<free port> and use that redirect uri`
            : error.message,
        ),
      ),
    );
    server.listen(PORT, () => console.log(`[drive-auth] listening for the redirect on ${REDIRECT_URI}`));
  });

const main = async () => {
  const { clientId, clientSecret, kind } = readCredentials();
  const auth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const url = auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  if (kind === 'web') {
    console.log(
      `\n[drive-auth] this is a "Web application" client, so add exactly this to its\n` +
        `             Authorized redirect URIs in Google Cloud first:\n\n    ${REDIRECT_URI}\n`,
    );
  }
  console.log('[drive-auth] open this url while signed in as the Drive owner:\n');
  console.log(url);
  console.log('\n[drive-auth] waiting for the approval...');

  const codePromise = waitForCode();
  const code = await codePromise;
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token - revoke the app at myaccount.google.com/permissions and retry',
    );
  }

  console.log('[drive-auth] refresh token received');
  upsertEnv({
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
    GOOGLE_DRIVE_ENABLED: 'true',
  });
  console.log('[drive-auth] done - restart the backend and recordings will be uploaded');
};

main().catch((error) => {
  console.error('[drive-auth] failed:', error.message);
  process.exit(1);
});
