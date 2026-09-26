import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, useNavigate } from "react-router";
import DatePicker from "../../src/components/DatePicker/DatePicker.jsx";
import Pagination from "../../src/components/Pagination/Pagination.jsx";
import AvailabilityEditor from "../../src/components/AvailabilityEditor/AvailabilityEditor.jsx";
import NavDrawer from "../../src/components/NavDrawer/NavDrawer.jsx";
import Header from "../../src/components/Header/Header.jsx";
import AnimatedRoutes, {
  EXIT_MS,
  Redirect,
} from "../../src/components/AnimatedRoutes/AnimatedRoutes.jsx";
import Captcha from "../../src/components/Captcha/Captcha.jsx";
import { renderWithProviders } from "../testUtils.jsx";

vi.mock("../../src/api/commonApi.js", () => ({
  getCaptcha: vi.fn(() =>
    Promise.resolve({
      data: { captchaId: "cap-123", image: "data:image/png;base64,AAAA" },
    }),
  ),
}));

describe("DatePicker", () => {
  it("disables weekdays that are not enabled and selects enabled ones", async () => {
    const onSel = vi.fn();
    render(
      <DatePicker
        label="Date"
        value="2026-09-22"
        startDate="2026-09-01"
        endDate="2026-09-30"
        enabledWeekDays={[1, 3]}
        onDateSelect={onSel}
      />,
    );
    await userEvent.click(screen.getByLabelText("Date"));
    const dlg = screen.getByRole("dialog");
    expect(dlg.querySelector('[data-date="2026-09-22"]')).toBeDisabled(); // Tuesday
    const wed = dlg.querySelector('[data-date="2026-09-23"]');
    expect(wed).toBeEnabled();
    await userEvent.click(wed);
    expect(onSel).toHaveBeenCalledWith("2026-09-23");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("respects start and end dates", async () => {
    render(
      <DatePicker
        label="Date"
        value="2026-09-15"
        startDate="2026-09-10"
        endDate="2026-09-20"
        onDateSelect={() => {}}
      />,
    );
    await userEvent.click(screen.getByLabelText("Date"));
    const dlg = screen.getByRole("dialog");
    expect(dlg.querySelector('[data-date="2026-09-09"]')).toBeDisabled();
    expect(dlg.querySelector('[data-date="2026-09-10"]')).toBeEnabled();
    expect(dlg.querySelector('[data-date="2026-09-21"]')).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });
  it("year selection shows decades first, starting from 1900, then years then months", async () => {
    const onSel = vi.fn();
    render(
      <DatePicker label="DOB" endDate="2026-09-22" onDateSelect={onSel} />,
    );
    await userEvent.click(screen.getByLabelText("DOB"));
    await userEvent.click(screen.getByRole("button", { name: "Choose year" }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText("Select decade")).toBeInTheDocument();
    const decades = [...dlg.querySelectorAll("[data-decade]")].map((b) =>
      Number(b.dataset.decade),
    );
    expect(decades[0]).toBe(1900);
    expect(decades.at(-1)).toBe(2020);
    await userEvent.click(dlg.querySelector('[data-decade="1990"]'));
    await userEvent.click(within(dlg).getByRole("button", { name: "1994" }));
    await userEvent.click(within(dlg).getByRole("button", { name: "Mar" }));
    await userEvent.click(dlg.querySelector('[data-date="1994-03-15"]'));
    expect(onSel).toHaveBeenCalledWith("1994-03-15");
  });
  it("month view is reachable from the day header", async () => {
    render(
      <DatePicker label="Date" value="2026-09-15" onDateSelect={() => {}} />,
    );
    await userEvent.click(screen.getByLabelText("Date"));
    await userEvent.click(screen.getByRole("button", { name: "Choose month" }));
    expect(screen.getByRole("button", { name: "Jan" })).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  const items = Array.from({ length: 57 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    city: i % 2 ? "Kolkata" : "Howrah",
  }));
  const renderPg = () =>
    render(
      <Pagination
        items={items}
        itemProcessor={(it) => <span data-testid="row">{it.name}</span>}
      />,
    );

  it("defaults to 5 per page with controls above and below", () => {
    renderPg();
    expect(screen.getAllByTestId("row")).toHaveLength(5);
    expect(screen.getByTestId("pagination-top")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-bottom")).toBeInTheDocument();
    expect(screen.getAllByText("Showing 1-5 of 57")).toHaveLength(2);
  });
  it("shows at most 5 page links", async () => {
    renderPg();
    const top = screen.getByTestId("pagination-top");
    expect(
      within(top).getAllByRole("button", { name: /^Page \d+$/ }),
    ).toHaveLength(5);
    await userEvent.click(
      within(top).getByRole("button", { name: "Last page" }),
    );
    expect(
      within(top)
        .getAllByRole("button", { name: /^Page \d+$/ })
        .map((b) => b.textContent),
    ).toEqual(["8", "9", "10", "11", "12"]);
    expect(screen.getAllByTestId("row")).toHaveLength(2);
  });
  it("offers 5 / 10 / 20 per page", async () => {
    renderPg();
    const sel = screen.getByTestId("pagination-top").querySelector("select");
    expect(
      [...sel.options].filter((o) => !o.disabled).map((o) => o.value),
    ).toEqual(["5", "10", "20"]);
    await userEvent.selectOptions(sel, "20");
    expect(screen.getAllByTestId("row")).toHaveLength(20);
  });
  it("jumps to a page from the textbox", async () => {
    renderPg();
    const box = screen.getByLabelText("Jump to page (bottom)");
    await userEvent.type(box, "4{enter}");
    expect(screen.getAllByText("Showing 16-20 of 57")).toHaveLength(2);
  });
  it("filters with free text search", async () => {
    renderPg();
    await userEvent.type(screen.getByLabelText("Search list"), "Item 5");
    expect(screen.getAllByTestId("row").map((r) => r.textContent)).toEqual([
      "Item 5",
      "Item 50",
      "Item 51",
      "Item 52",
      "Item 53",
    ]);
    await userEvent.clear(screen.getByLabelText("Search list"));
    await userEvent.type(screen.getByLabelText("Search list"), "zzz");
    expect(screen.getByText("No matching results")).toBeInTheDocument();
  });
});

describe("AvailabilityEditor", () => {
  function Harness({ initial = [] }) {
    const [v, setV] = useState(initial);
    return (
      <>
        <AvailabilityEditor value={v} onChange={setV} />
        <output data-testid="val">{JSON.stringify(v)}</output>
      </>
    );
  }
  const val = () => JSON.parse(screen.getByTestId("val").textContent);

  it("enabling a day adds a default slot", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Monday available"));
    expect(val()).toEqual([
      { weekday: 1, startTime: "09:00", endTime: "10:00" },
    ]);
  });
  it("end time options only list times after the start", async () => {
    render(
      <Harness
        initial={[{ weekday: 1, startTime: "09:00", endTime: "10:00" }]}
      />,
    );
    const end = document.getElementById("end-1-0");
    const values = [...end.options]
      .filter((o) => !o.disabled)
      .map((o) => o.value);
    expect(values[0]).toBe("09:30");
    expect(values.at(-1)).toBe("24:00");
    await userEvent.selectOptions(
      document.getElementById("start-1-0"),
      "11:00",
    );
    expect(val()[0]).toEqual({
      weekday: 1,
      startTime: "11:00",
      endTime: "11:30",
    });
  });
  it("second slot does not overlap the first and copy to all fills the week", async () => {
    render(
      <Harness
        initial={[{ weekday: 1, startTime: "09:00", endTime: "10:00" }]}
      />,
    );
    await userEvent.click(
      within(screen.getByTestId("day-1")).getByRole("button", {
        name: "+ Add slot",
      }),
    );
    const [a, b] = val();
    expect(b.startTime >= a.endTime).toBe(true);
    const startOpts = [...document.getElementById("start-1-1").options].map(
      (o) => o.value,
    );
    expect(startOpts).not.toContain("09:30");
    await userEvent.click(
      within(screen.getByTestId("day-1")).getByRole("button", {
        name: "Copy to all",
      }),
    );
    expect(new Set(val().map((r) => r.weekday)).size).toBe(7);
    expect(val()).toHaveLength(14);
  });
});

describe("NavDrawer and Header", () => {
  it("drawer lists the role links and closes with the cross", async () => {
    const onClose = vi.fn();
    renderWithProviders(<NavDrawer open role="admin" onClose={onClose} />, {
      role: "admin",
    });
    expect(
      screen.getByRole("link", { name: /Add Doctor/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Doctor List/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Reschedule/ }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );
    expect(onClose).toHaveBeenCalled();
  });
  it("header shows name, email, logout and hamburger", async () => {
    const onMenu = vi.fn();
    const onLogout = vi.fn();
    renderWithProviders(<Header onMenuClick={onMenu} onLogout={onLogout} />, {
      role: "patient",
    });
    expect(screen.getByTestId("header-name")).toHaveTextContent("Rina Sen");
    expect(screen.getByTestId("header-email")).toHaveTextContent(
      "rina@example.com",
    );
    expect(document.querySelector(".logo-name")).toHaveTextContent(
      "West Bengal Forum for Mental Health",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Logout/ }));
    expect(onMenu).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });
});

describe("AnimatedRoutes", () => {
  function Nav() {
    const n = useNavigate();
    return (
      <button type="button" onClick={() => n("/b")}>
        go
      </button>
    );
  }
  it("keeps the previous view mounted while it slides out", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <MemoryRouter initialEntries={["/a"]}>
        <Nav />
        <AnimatedRoutes>
          <Route path="/a" element={<p>View A</p>} />
          <Route path="/b" element={<p>View B</p>} />
        </AnimatedRoutes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("View B")).toBeInTheDocument();
    expect(screen.getByText("View A")).toBeInTheDocument();
    expect(screen.getByTestId("route-layer-exit")).toHaveTextContent("View A");
    act(() => {
      vi.advanceTimersByTime(EXIT_MS + 200);
    });
    await waitFor(() =>
      expect(screen.queryByText("View A")).not.toBeInTheDocument(),
    );
    vi.useRealTimers();
  });
});

describe("Redirect inside AnimatedRoutes", () => {
  function Probe() {
    const n = useNavigate();
    return (
      <button type="button" onClick={() => n("/register")}>
        to register
      </button>
    );
  }
  it("a redirect in the view that slides out does not fire again", async () => {
    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Probe />
        <AnimatedRoutes>
          <Route path="/login" element={<p>Login view</p>} />
          <Route path="/register" element={<p>Register view</p>} />
          <Route path="*" element={<Redirect to="/login" replace />} />
        </AnimatedRoutes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Login view")).toBeInTheDocument();
    fireEvent.click(screen.getByText("to register"));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText("Register view")).toBeInTheDocument();
    expect(screen.getByTestId("route-layer-enter")).toHaveTextContent(
      "Register view",
    );
  });
});

describe("Captcha", () => {
  it("loads an image and reports the id with the typed text", async () => {
    const onChange = vi.fn();
    render(<Captcha onChange={onChange} />);
    await waitFor(() =>
      expect(document.querySelector("canvas").dataset.captchaId).toBe(
        "cap-123",
      ),
    );
    const input = screen.getByLabelText("Captcha");
    await userEvent.type(input, "ab cd");
    expect(onChange).toHaveBeenLastCalledWith({
      captchaId: "cap-123",
      captchaText: "abcd",
    });
    expect(document.body.textContent).not.toMatch(/cap-123/);
  });
});
