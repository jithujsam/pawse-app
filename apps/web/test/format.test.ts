import { describe, expect, it } from "vitest";
import { days, fmtNum, lostMonths, money, monthsText, plural } from "../src/format";

describe("plurals and numbers", () => {
  it("uses the singular only for one", () => {
    expect(plural(1, "slip")).toBe("1 slip");
    expect(plural(0, "slip")).toBe("0 slips");
    expect(plural(2, "slip")).toBe("2 slips");
    expect(plural(-1, "slip")).toBe("-1 slip");
    expect(plural(1000, "slip")).toBe("1,000 slips");
    expect(days(1)).toBe("1 day");
    expect(plural(2, "urge")).toBe("2 urges");
  });
  it("says month once, whatever the rounding does", () => {
    expect(monthsText(1)).toBe("1 month");
    expect(monthsText(1.04)).toBe("1 month");
    expect(monthsText(0.96)).toBe("1 month");
    expect(monthsText(0)).toBe("0 months");
    expect(monthsText(0.5)).toBe("0.5 months");
    expect(monthsText(4.25)).toBe("4.3 months");
    expect(monthsText(123.456)).toBe("123.5 months");
    expect(lostMonths(1)).toBe("−1 month");
    expect(lostMonths(-2.5)).toBe("−2.5 months");
  });
  it("rounds for display only and never shows -0 or NaN", () => {
    expect(fmtNum(0.04)).toBe("0");
    expect(fmtNum(-0.04)).toBe("0");
    expect(fmtNum(NaN)).toBe("0");
    expect(fmtNum(2.5, 0)).toBe("3");
  });
});

describe("money", () => {
  it("sits a symbol against the number and spaces a code", () => {
    expect(money("₹", 500)).toBe("₹500");
    expect(money("$", 12.5)).toBe("$12.5");
    expect(money("R$", 40)).toBe("R$40");
    expect(money("AED", 500)).toBe("AED 500");
    expect(money("Rs", 1200)).toBe("Rs 1,200");
    expect(money("", 30)).toBe("30");
    expect(money("₹", 0)).toBe("₹0");
    expect(money("₹", 1234567)).toBe("₹1,234,567");
    expect(money("₹", -5)).toBe("−₹5");
  });
});
