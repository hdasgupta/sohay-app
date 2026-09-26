import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "../src/context/ThemeContext.jsx";
import { AuthProvider } from "../src/context/AuthContext.jsx";
import { saveAuth } from "../src/utils/authStorage.js";

export const USERS = {
  admin: {
    id: 1,
    name: "Administrator",
    email: "wbffmh@gmail.com",
    role: "admin",
  },
  patient: {
    id: 5,
    name: "Rina Sen",
    email: "rina@example.com",
    role: "patient",
  },
  doctor: {
    id: 9,
    name: "Dr. Amit Das",
    email: "amit@example.com",
    role: "doctor",
  },
};

/** Render inside theme + auth + router. role logs a fake user in first. */
export function renderWithProviders(ui, { route = "/", role } = {}) {
  if (role) saveAuth({ token: "test-token", user: USERS[role] });
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

export const ok = (data, message = "OK") => Promise.resolve({ data, message });
