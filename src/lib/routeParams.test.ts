import { describe, expect, test } from "vitest";
import { isIsoDateParam, isTimeParam, routeParamString } from "./routeParams";

describe("route param helpers", () => {
  test("accept exactly one non-empty string", () => {
    expect(routeParamString("abc123")).toBe("abc123");
    expect(routeParamString(" abc123 ")).toBe("abc123");
  });

  test("reject missing, blank, or multi-value params", () => {
    expect(routeParamString(undefined)).toBeNull();
    expect(routeParamString("")).toBeNull();
    expect(routeParamString("   ")).toBeNull();
    expect(routeParamString(["one", "two"])).toBeNull();
  });

  test("validates booking date and time params", () => {
    expect(isIsoDateParam("2099-01-05")).toBe(true);
    expect(isIsoDateParam("2099-1-5")).toBe(false);
    expect(isIsoDateParam("not-a-date")).toBe(false);

    expect(isTimeParam("09:30")).toBe(true);
    expect(isTimeParam("9:30")).toBe(false);
    expect(isTimeParam("24:00")).toBe(false);
  });
});
