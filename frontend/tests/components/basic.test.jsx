import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dropdown from "../../src/components/Dropdown/Dropdown.jsx";
import Password from "../../src/components/Password/Password.jsx";
import MessageBox from "../../src/components/MessageBox/MessageBox.jsx";
import Loader from "../../src/components/Loader/Loader.jsx";
import ErrorHandler from "../../src/components/ErrorHandler/ErrorHandler.jsx";
import { notify, loaderBus } from "../../src/utils/eventBus.js";

describe("Dropdown", () => {
  const docs = [
    { id: 1, name: "Dr A" },
    { id: 2, name: "Dr B" },
  ];
  it("renders a disabled placeholder and processed labels", () => {
    render(
      <Dropdown
        options={docs}
        labelProcessor={(d) => d.name}
        placeholder="Choose doctor"
        label="Doctor"
      />,
    );
    const ph = screen.getByRole("option", { name: "Choose doctor" });
    expect(ph).toBeDisabled();
    expect(screen.getByRole("option", { name: "Dr B" })).toBeInTheDocument();
    expect(screen.getByLabelText("Doctor")).toHaveValue("");
  });
  it("passes the whole selected object to onOptionSelected", async () => {
    const onSel = vi.fn();
    render(
      <Dropdown
        options={docs}
        labelProcessor={(d) => d.name}
        onOptionSelected={onSel}
        label="Doctor"
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Doctor"), "2");
    expect(onSel).toHaveBeenCalledWith(docs[1]);
  });
});

describe("Password", () => {
  it("shows each rule on its own line with pass/fail state", () => {
    const { rerender, container } = render(
      <Password value="abc" onChange={() => {}} />,
    );
    expect(
      container.querySelectorAll(".pw-rules li, [data-rule]").length,
    ).toBeGreaterThanOrEqual(6);
    expect(
      screen.getByText("At least one lower case letter").closest("li"),
    ).toHaveClass(/ok|pass/);
    expect(
      screen.getByText("At least one upper case letter").closest("li"),
    ).not.toHaveClass(/ok|pass/);
    rerender(<Password value="Abcdef1!" onChange={() => {}} />);
    expect(
      screen.getByText("At least 8 characters long").closest("li"),
    ).toHaveClass(/ok|pass/);
  });
  it("toggles visibility with the eye button", async () => {
    render(
      <Password
        value="Secret1!"
        onChange={() => {}}
        id="pw"
        label="Password"
      />,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(input).toHaveAttribute("type", "text");
  });
  it("confirm mode only checks matching", () => {
    render(
      <Password value="Abcdef1!" matchWith="Abcdef1!" onChange={() => {}} />,
    );
    expect(screen.getByText("Both passwords match").closest("li")).toHaveClass(
      /ok|pass/,
    );
    expect(screen.queryByText("No spaces")).not.toBeInTheDocument();
  });
});

describe("MessageBox", () => {
  it("shows typed messages and closes them after 10 seconds", () => {
    vi.useFakeTimers();
    render(<MessageBox />);
    act(() => {
      notify.success("Saved");
      notify.error("Failed");
    });
    expect(screen.getByText("Saved").closest(".mb-toast")).toHaveAttribute(
      "data-type",
      "success",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    expect(
      screen.getAllByTestId("mb-progress")[0].style.animationDuration,
    ).toBe("10000ms");
    act(() => {
      vi.advanceTimersByTime(9900);
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
  it("can be closed manually", async () => {
    render(<MessageBox />);
    act(() => notify.warning("Careful"));
    fireEvent.click(screen.getByRole("button", { name: "Close message" }));
    expect(screen.queryByText("Careful")).not.toBeInTheDocument();
  });
});

describe("Loader", () => {
  it("shows the hourglass with a message while a call runs", () => {
    render(<Loader />);
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
    act(() =>
      loaderBus.emit({
        type: "start",
        id: 1,
        message: "Booking your appointment...",
      }),
    );
    expect(screen.getByLabelText("Loading")).toHaveTextContent(
      "Booking your appointment...",
    );
    act(() => loaderBus.emit({ type: "stop", id: 1 }));
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
  });
});

describe("ErrorHandler", () => {
  it("catches render errors and reports them to the message box", () => {
    const Boom = () => {
      throw new Error("kaboom");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <MessageBox />
        <ErrorHandler>
          <Boom />
        </ErrorHandler>
      </>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getAllByText(/kaboom/).length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
