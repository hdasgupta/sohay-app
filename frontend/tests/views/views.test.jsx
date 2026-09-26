import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router";
import { renderWithProviders, ok } from "../testUtils.jsx";
import { todayIso, addDaysIso, weekdayOfIso } from "../../src/utils/date.js";

vi.mock("../../src/api/commonApi.js", () => ({
  getCaptcha: vi.fn(() =>
    Promise.resolve({
      data: { captchaId: "cap-1", image: "data:image/png;base64,AAAA" },
    }),
  ),
  login: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  registerPatient: vi.fn(),
  resetPassword: vi.fn(),
  downloadPrescription: vi.fn(() =>
    Promise.resolve(new Blob(["%PDF"], { type: "application/pdf" })),
  ),
}));
vi.mock("../../src/api/patientApi.js", () => ({
  listDoctors: vi.fn(),
  members: vi.fn(),
  slots: vi.fn(),
  book: vi.fn(),
  listAppointments: vi.fn(),
  cancelAppointment: vi.fn(),
  getFamily: vi.fn(),
  createFamily: vi.fn(),
  invite: vi.fn(),
  respond: vi.fn(),
  withdrawInvitation: vi.fn(),
  leaveFamily: vi.fn(),
}));
vi.mock("../../src/api/doctorApi.js", () => ({
  todayAppointments: vi.fn(),
  searchMedicines: vi.fn(),
  profile: vi.fn(),
  saveSignature: vi.fn(),
  createPrescription: vi.fn(),
  listAppointments: vi.fn(),
}));
vi.mock("../../src/api/adminApi.js", () => ({
  listDoctors: vi.fn(),
  setDoctorDisabled: vi.fn(),
  listPatients: vi.fn(),
  upcomingAppointments: vi.fn(),
  rescheduleSlots: vi.fn(),
  reschedule: vi.fn(),
}));
vi.mock("../../src/utils/download.js", () => ({ saveBlob: vi.fn() }));

const common = await import("../../src/api/commonApi.js");
const patient = await import("../../src/api/patientApi.js");
const doctorApi = await import("../../src/api/doctorApi.js");
const admin = await import("../../src/api/adminApi.js");
const { default: LoginPage } =
  await import("../../src/views/auth/LoginPage.jsx");
const { default: RegisterPage } =
  await import("../../src/views/auth/RegisterPage.jsx");
const { default: BookAppointmentPage } =
  await import("../../src/views/patient/BookAppointmentPage.jsx");
const { default: AppointmentListPage } =
  await import("../../src/views/patient/AppointmentListPage.jsx");
const { default: GeneratePrescriptionPage } =
  await import("../../src/views/doctor/GeneratePrescriptionPage.jsx");
const { default: FamilyPage } =
  await import("../../src/views/patient/FamilyPage.jsx");
const { default: DoctorListPage } =
  await import("../../src/views/admin/DoctorListPage.jsx");
const { default: ReschedulePage } =
  await import("../../src/views/admin/ReschedulePage.jsx");

beforeEach(() => {
  vi.clearAllMocks();
});

const today = todayIso();
const DOCTOR = {
  id: 9,
  name: "Dr. Amit Das",
  speciality: "Psychiatrist",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
};

describe("LoginPage", () => {
  it("opens the deep link requested before login", async () => {
    common.login.mockResolvedValue({
      data: {
        token: "tok",
        expiresAt: new Date(Date.now() + 1e9).toISOString(),
        user: {
          id: 5,
          name: "Rina",
          email: "rina@example.com",
          role: "patient",
        },
      },
      message: "Welcome Rina",
    });
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/patient/appointments"
          element={<p>Appointments view</p>}
        />
      </Routes>,
      {
        route: {
          pathname: "/login",
          state: { from: { pathname: "/patient/appointments", search: "" } },
        },
      },
    );
    expect(screen.getByText("/patient/appointments")).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "rina@example.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "Secret@123");
    await waitFor(() => expect(common.getCaptcha).toHaveBeenCalled());
    await userEvent.type(screen.getByLabelText("Captcha"), "ABCDE");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Appointments view")).toBeInTheDocument();
    expect(common.login).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "rina@example.com",
        captchaId: "cap-1",
        captchaText: "ABCDE",
      }),
    );
    expect(JSON.parse(localStorage.getItem("wbfmh.auth")).token).toBe("tok");
  });
  it("has links to register and reset password and no role selector", () => {
    renderWithProviders(<LoginPage />, { route: "/login" });
    expect(
      screen.getByRole("link", { name: "New patient? Register" }),
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/reset-password");
    expect(screen.queryByText(/role/i)).not.toBeInTheDocument();
  });
});

describe("RegisterPage", () => {
  it("keeps Register disabled until the email OTP is verified", async () => {
    common.sendOtp.mockResolvedValue({
      data: {
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        validitySeconds: 600,
      },
      message: "OTP sent",
    });
    common.verifyOtp.mockResolvedValue({
      data: { verificationToken: "vt" },
      message: "Email verified",
    });
    renderWithProviders(<RegisterPage />, { route: "/register" });
    const btn = screen.getByRole("button", { name: "Register" });
    expect(btn).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "new@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
    expect(await screen.findByText(/OTP valid for/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("OTP"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(btn).toBeEnabled());
    expect(common.verifyOtp).toHaveBeenCalledWith(
      "new@example.com",
      "register",
      "123456",
    );
  });
});

describe("BookAppointmentPage", () => {
  it("books a slot returned by the API for the chosen family member", async () => {
    patient.listDoctors.mockReturnValue(ok([DOCTOR]));
    patient.members.mockReturnValue(
      ok({
        family: { id: 1, name: "Sen" },
        members: [
          { id: 5, name: "Rina Sen" },
          { id: 6, name: "Tapas Sen" },
        ],
      }),
    );
    patient.slots.mockReturnValue(ok(["10:00", "10:30"]));
    patient.book.mockReturnValue(
      ok(
        {
          id: 77,
          doctorName: DOCTOR.name,
          doctorSpeciality: "Psychiatrist",
          patientId: 6,
          patientName: "Tapas Sen",
          bookedById: 5,
          date: addDaysIso(today, 1),
          startTime: "10:30",
          endTime: "11:00",
          status: "scheduled",
        },
        "Appointment booked",
      ),
    );
    renderWithProviders(<BookAppointmentPage />, { role: "patient" });
    const memberSel = await screen.findByLabelText(/Patient \(family: Sen\)/);
    await userEvent.selectOptions(memberSel, "6");
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Dr. Amit Das/ }),
      ).toBeInTheDocument(),
    );
    await userEvent.selectOptions(screen.getByLabelText("Doctor"), "9");
    await userEvent.click(screen.getByLabelText("Date"));
    const target = addDaysIso(today, 1);
    const cell =
      document.querySelector(`[data-date="${target}"]`) ||
      (await userEvent.click(
        screen.getByRole("button", { name: "Next month" }),
      ),
      document.querySelector(`[data-date="${target}"]`));
    await userEvent.click(cell);
    await waitFor(() =>
      expect(patient.slots).toHaveBeenCalledWith(9, target, 6),
    );
    const slotSel = screen.getByLabelText("Time slot (IST)");
    await waitFor(() => expect(slotSel).toBeEnabled());
    await userEvent.selectOptions(slotSel, "10:30");
    await userEvent.click(
      screen.getByRole("button", { name: "Book appointment" }),
    );
    await waitFor(() =>
      expect(patient.book).toHaveBeenCalledWith({
        doctorId: 9,
        date: target,
        startTime: "10:30",
        patientId: 6,
      }),
    );
    expect(
      await screen.findByText("Appointment confirmed"),
    ).toBeInTheDocument();
  });
  it("hides the family member dropdown when not in a family", async () => {
    patient.listDoctors.mockReturnValue(ok([DOCTOR]));
    patient.members.mockReturnValue(
      ok({ family: null, members: [{ id: 5, name: "Rina Sen" }] }),
    );
    renderWithProviders(<BookAppointmentPage />, { role: "patient" });
    await screen.findByRole("option", { name: /Dr. Amit Das/ });
    expect(screen.queryByLabelText(/Patient \(family/)).not.toBeInTheDocument();
  });
});

describe("AppointmentListPage", () => {
  it("shows cancel for upcoming and download for completed appointments", async () => {
    patient.listAppointments.mockReturnValue(
      ok([
        {
          id: 2,
          doctorName: "Dr. B",
          doctorSpeciality: "Psychologist",
          patientId: 5,
          bookedById: 5,
          patientName: "Rina",
          date: addDaysIso(today, 3),
          startTime: "10:00",
          endTime: "10:30",
          status: "scheduled",
          isUpcoming: true,
        },
        {
          id: 1,
          doctorName: "Dr. A",
          doctorSpeciality: "Psychiatrist",
          patientId: 5,
          bookedById: 5,
          patientName: "Rina",
          date: addDaysIso(today, -3),
          startTime: "10:00",
          endTime: "10:30",
          status: "completed",
          isUpcoming: false,
          hasPrescription: true,
        },
      ]),
    );
    patient.cancelAppointment.mockReturnValue(
      ok({ status: "cancelled", isUpcoming: false }, "Appointment cancelled"),
    );
    renderWithProviders(<AppointmentListPage />, { role: "patient" });
    const cancelBtn = await screen.findByRole("button", { name: "Cancel" });
    await userEvent.click(
      screen.getByRole("button", { name: "Download prescription" }),
    );
    await waitFor(() =>
      expect(common.downloadPrescription).toHaveBeenCalledWith(1),
    );
    await userEvent.click(cancelBtn);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: /Cancel appointment|Yes|Confirm/,
      }),
    );
    await waitFor(() =>
      expect(patient.cancelAppointment).toHaveBeenCalledWith(2),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("GeneratePrescriptionPage", () => {
  it("adds medicines with guessed doses and generates the prescription", async () => {
    doctorApi.todayAppointments.mockReturnValue(
      ok([
        {
          appointmentId: 31,
          patientId: 5,
          patientName: "Rina Sen",
          patientEmail: "rina@example.com",
          patientSex: "Female",
          dateOfBirth: "1990-01-01",
          age: 36,
          date: today,
          startTime: "10:00",
          endTime: "10:30",
          status: "scheduled",
        },
      ]),
    );
    doctorApi.profile.mockReturnValue(
      ok({
        id: 9,
        name: "Dr. Amit Das",
        signature: "data:image/png;base64,AAAA",
      }),
    );
    doctorApi.searchMedicines.mockReturnValue(
      ok([
        { id: 1, name: "Crocin 500 Tablet" },
        { id: 2, name: "Benadryl Syrup" },
      ]),
    );
    doctorApi.createPrescription.mockReturnValue(
      ok(
        { prescriptionId: 3, appointmentId: 31, pdfUrl: "https://x/y.pdf" },
        "Prescription generated",
      ),
    );
    renderWithProviders(<GeneratePrescriptionPage />, { role: "doctor" });
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Rina Sen/ }),
      ).toBeInTheDocument(),
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Today's patient"),
      "31",
    );
    const age = screen.getByLabelText("Age (years)");
    expect(age).toHaveValue(36);
    await userEvent.clear(age);
    await userEvent.type(age, "35");

    await userEvent.type(screen.getByLabelText("Search medicine"), "cro");
    const results = screen.getByLabelText(/Search results/);
    await waitFor(() => expect(results).toBeEnabled(), { timeout: 2000 });
    await userEvent.selectOptions(results, "1");
    expect(screen.getByLabelText("Medicine")).toHaveValue("Crocin 500 Tablet");
    expect(screen.getByLabelText("Dose")).toHaveValue("1 pcs");
    const addBtn = screen.getByRole("button", { name: "+ Add medicine" });
    expect(addBtn).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Morning/ }));
    await userEvent.click(screen.getByRole("button", { name: /Night/ }));
    await userEvent.selectOptions(screen.getByLabelText("Food"), "after_food");
    await userEvent.click(addBtn);
    expect(screen.getAllByTestId("rx-item")).toHaveLength(1);

    await userEvent.type(screen.getByLabelText("Search medicine"), "ben");
    await waitFor(
      () => expect(screen.getByLabelText(/Search results/)).toBeEnabled(),
      { timeout: 2000 },
    );
    await userEvent.selectOptions(screen.getByLabelText(/Search results/), "2");
    expect(screen.getByLabelText("Dose")).toHaveValue("10 ml");
    await userEvent.click(screen.getByRole("button", { name: /SOS/ }));
    await userEvent.selectOptions(screen.getByLabelText("Food"), "with_food");
    await userEvent.click(
      screen.getByRole("button", { name: "+ Add medicine" }),
    );
    expect(screen.getAllByTestId("rx-item")).toHaveLength(2);

    await userEvent.click(
      screen.getByRole("button", { name: "Generate prescription" }),
    );
    await waitFor(() =>
      expect(doctorApi.createPrescription).toHaveBeenCalled(),
    );
    const body = doctorApi.createPrescription.mock.calls[0][0];
    expect(body).toMatchObject({ appointmentId: 31, patientAge: 35 });
    expect(body.items[0]).toMatchObject({
      medicineName: "Crocin 500 Tablet",
      dose: "1 pcs",
      morning: true,
      night: true,
      foodTiming: "after_food",
    });
    expect(body.items[1]).toMatchObject({
      medicineName: "Benadryl Syrup",
      dose: "10 ml",
      sos: true,
      foodTiming: "with_food",
    });
    expect(
      await screen.findByText(/Prescription ready for Rina Sen/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Rina Sen/ }),
    ).not.toBeInTheDocument(); // completed -> cannot modify
  });
});

describe("DoctorListPage", () => {
  it("lists doctors and disables one after confirmation", async () => {
    admin.listDoctors.mockReturnValue(
      ok([
        {
          id: 1,
          name: "Dr. One",
          email: "one@example.com",
          sex: "Male",
          speciality: "Psychiatrist",
          isDisabled: false,
          availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }],
        },
        {
          id: 2,
          name: "Dr. Two",
          email: "two@example.com",
          sex: "Female",
          speciality: "Psychologist",
          isDisabled: true,
          availability: [],
        },
      ]),
    );
    admin.setDoctorDisabled.mockReturnValue(ok(null, "Doctor disabled"));
    renderWithProviders(<DoctorListPage />, { role: "admin" });
    const one = await screen.findByTestId("doctor-1");
    expect(
      within(screen.getByTestId("doctor-2")).getByRole("button", {
        name: "Enable",
      }),
    ).toBeInTheDocument();
    await userEvent.click(within(one).getByRole("button", { name: "Disable" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Disable/ }),
    );
    await waitFor(() =>
      expect(admin.setDoctorDisabled).toHaveBeenCalledWith(1, true),
    );
    expect(
      await within(screen.getByTestId("doctor-1")).findByRole("button", {
        name: "Enable",
      }),
    ).toBeInTheDocument();
  });
});

describe("ReschedulePage", () => {
  it("shows a message when the patient has no upcoming appointment with the doctor", async () => {
    admin.listPatients.mockReturnValue(
      ok([{ id: 5, name: "Rina Sen", email: "rina@example.com" }]),
    );
    admin.listDoctors.mockReturnValue(ok([{ ...DOCTOR, availability: [] }]));
    admin.upcomingAppointments.mockReturnValue(ok([]));
    renderWithProviders(<ReschedulePage />, { role: "admin" });
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Rina Sen/ }),
      ).toBeInTheDocument(),
    );
    await userEvent.selectOptions(screen.getByLabelText("Patient"), "5");
    await userEvent.selectOptions(screen.getByLabelText("Doctor"), "9");
    expect(
      await screen.findByText("No upcoming appointment"),
    ).toBeInTheDocument();
    expect(admin.upcomingAppointments).toHaveBeenCalledWith(5, 9);
  });
});

describe("FamilyPage", () => {
  it("creates a family, invites a patient and answers a received invitation", async () => {
    patient.getFamily
      .mockReturnValueOnce(
        ok({
          family: null,
          members: [],
          sentInvitations: [],
          receivedInvitations: [
            {
              id: 4,
              familyName: "Roy",
              inviterName: "Ria Roy",
              inviterEmail: "ria@example.com",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      )
      .mockReturnValue(
        ok({
          family: { id: 1, name: "Sen" },
          members: [{ id: 5, name: "Rina Sen", email: "rina@example.com" }],
          sentInvitations: [],
          receivedInvitations: [],
        }),
      );
    patient.createFamily.mockReturnValue(ok({ id: 1 }, "Family created"));
    patient.invite.mockReturnValue(ok({ id: 8 }, "Invitation sent"));
    patient.respond.mockReturnValue(ok(null, "Invitation rejected"));
    renderWithProviders(<FamilyPage />, { role: "patient" });
    await userEvent.click(
      await screen.findByRole("button", { name: "Reject" }),
    );
    await waitFor(() =>
      expect(patient.respond).toHaveBeenCalledWith(4, "reject"),
    );
    const invite = await screen.findByLabelText("Invite by email");
    await userEvent.type(invite, "tapas@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: "Send invitation" }),
    );
    await waitFor(() =>
      expect(patient.invite).toHaveBeenCalledWith("tapas@example.com"),
    );
  });
  it("lets a patient without a family create one", async () => {
    patient.getFamily.mockReturnValue(
      ok({
        family: null,
        members: [],
        sentInvitations: [],
        receivedInvitations: [],
      }),
    );
    patient.createFamily.mockReturnValue(ok({ id: 1 }, "Family created"));
    renderWithProviders(<FamilyPage />, { role: "patient" });
    await userEvent.type(
      await screen.findByLabelText("Family name"),
      "The Sen Family",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create family" }),
    );
    await waitFor(() =>
      expect(patient.createFamily).toHaveBeenCalledWith("The Sen Family"),
    );
  });
});
