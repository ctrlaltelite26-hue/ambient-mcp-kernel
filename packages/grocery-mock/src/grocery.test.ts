import { describe, expect, it } from "vitest";

import { Cart, formatMoneyMinor, listCatalog, lineFromSku } from "./index.js";

describe("grocery-mock", () => {
  it("lists catalog without third-party trademarks", () => {
    const names = listCatalog().map((i) => i.name.toLowerCase()).join(" ");
    expect(names).not.toMatch(/whole foods|prime|amazon/);
    expect(listCatalog().length).toBeGreaterThan(5);
  });

  it("formats money from minor units", () => {
    expect(formatMoneyMinor(1400)).toBe("$14.00");
    expect(formatMoneyMinor(84_00)).toBe("$84.00");
  });

  it("cart accumulates deterministic totals", () => {
    const cart = new Cart().addSku("coffee").addSku("milk", 2);
    expect(cart.totalMinor()).toBe(1400 + 450 * 2);
    expect(cart.toBasket()).toHaveLength(2);
    expect(lineFromSku("coffee").unitPriceMinor).toBe(1400);
  });
});
