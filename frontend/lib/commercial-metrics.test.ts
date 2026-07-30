import { describe, expect, it } from "vitest";
import { groupMonthlyRevenueByCurrency } from "./commercial-metrics";

describe("groupMonthlyRevenueByCurrency", () => {
  it("keeps different currencies separate", () => {
    expect(
      groupMonthlyRevenueByCurrency([
        { monthlyPrice: 1000, currency: "GBP" },
        { monthlyPrice: "250", currency: "gbp" },
        { monthlyPrice: 900, currency: "EUR" },
      ]),
    ).toEqual([
      { currency: "EUR", amount: 900, clientCount: 1 },
      { currency: "GBP", amount: 1250, clientCount: 2 },
    ]);
  });

  it("defaults missing currency to GBP", () => {
    expect(groupMonthlyRevenueByCurrency([{ monthlyPrice: null, currency: null }])).toEqual([
      { currency: "GBP", amount: 0, clientCount: 1 },
    ]);
  });
});
