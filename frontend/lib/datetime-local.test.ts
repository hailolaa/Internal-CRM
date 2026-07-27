import { describe, expect, it } from "vitest";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "./datetime-local";

describe("datetime-local conversion", () => {
  it("round-trips an API UTC timestamp through a local datetime input", () => {
    const utcValue = "2026-07-27T14:30:00.000Z";
    const localValue = toDatetimeLocalValue(utcValue);

    expect(localValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDatetimeLocalValue(localValue)).toBe(utcValue);
  });

  it("submits datetime-local values as ISO UTC and rejects invalid values", () => {
    const localValue = "2026-11-15T09:45";
    const isoValue = fromDatetimeLocalValue(localValue);

    expect(isoValue).toBe(new Date(localValue).toISOString());
    expect(isoValue).toMatch(/Z$/);
    expect(fromDatetimeLocalValue("not-a-date")).toBeNull();
    expect(toDatetimeLocalValue("not-a-date")).toBe("");
  });
});
