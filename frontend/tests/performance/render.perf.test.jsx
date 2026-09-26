import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "../../src/components/Pagination/Pagination.jsx";
import { guessDose } from "../../src/utils/medicine.js";
import { endOptionsFor } from "../../src/utils/timeSlots.js";

describe("frontend performance", () => {
  it("paginates and searches 10,000 items quickly", async () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Patient ${i}`,
      email: `p${i}@example.com`,
    }));
    const t0 = performance.now();
    render(
      <Pagination
        items={items}
        itemProcessor={(it) => <span data-testid="row">{it.name}</span>}
      />,
    );
    const renderMs = performance.now() - t0;
    expect(screen.getAllByTestId("row")).toHaveLength(5);
    const t1 = performance.now();
    await userEvent.type(screen.getByLabelText("Search list"), "9999");
    const searchMs = performance.now() - t1;
    expect(screen.getAllByTestId("row")).toHaveLength(1);
    console.log(
      `render 10k: ${renderMs.toFixed(1)} ms, search: ${searchMs.toFixed(1)} ms`,
    );
    expect(renderMs).toBeLessThan(1500);
    expect(searchMs).toBeLessThan(3000);
  });
  it("guesses doses for 250,000 medicine names in well under a second", () => {
    const names = [
      "Crocin 500 Tablet",
      "Benadryl Syrup",
      "Amoxil 250 Capsule",
      "Volini Gel",
    ];
    const t0 = performance.now();
    for (let i = 0; i < 250000; i += 1) guessDose(names[i % 4]);
    const ms = performance.now() - t0;
    console.log(`250k dose guesses: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(1000);
  });
  it("computes slot options for a full day repeatedly", () => {
    const day = [
      { startTime: "00:00", endTime: "06:00" },
      { startTime: "08:00", endTime: "12:00" },
      { startTime: "14:00", endTime: "" },
    ];
    const t0 = performance.now();
    for (let i = 0; i < 20000; i += 1) endOptionsFor(day, 2);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
