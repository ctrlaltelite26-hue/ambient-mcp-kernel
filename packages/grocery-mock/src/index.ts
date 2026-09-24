export interface CatalogItem {
  sku: string;
  name: string;
  unitPriceMinor: number;
}

/** Mock pantry catalog — no third-party trademarks. */
export const CATALOG: Record<string, CatalogItem> = {
  coffee: { sku: "coffee", name: "Coffee beans 340g", unitPriceMinor: 1400 },
  milk: { sku: "milk", name: "Milk 1L", unitPriceMinor: 450 },
  oats: { sku: "oats", name: "Rolled oats 1kg", unitPriceMinor: 600 },
  dish_soap: { sku: "dish_soap", name: "Dish soap", unitPriceMinor: 399 },
  candy: { sku: "candy", name: "Assorted candy", unitPriceMinor: 499 },
  paper_towels: { sku: "paper_towels", name: "Paper towels", unitPriceMinor: 1200 },
  mixer: { sku: "mixer", name: "Standing mixer", unitPriceMinor: 5000 },
  air_fryer: { sku: "air_fryer", name: "Air fryer", unitPriceMinor: 5000 },
  lawn_mower: { sku: "lawn_mower", name: "Lawn mower", unitPriceMinor: 6000 },
  fridge: { sku: "fridge", name: "Fridge", unitPriceMinor: 129900 },
  vacuum: { sku: "vacuum", name: "Vacuum", unitPriceMinor: 19900 },
  drone: { sku: "drone", name: "Toy drone", unitPriceMinor: 8900 },
  game: { sku: "game", name: "Video game", unitPriceMinor: 5999 },
  headphones: { sku: "headphones", name: "Headphones", unitPriceMinor: 7900 },
  tv: { sku: "tv", name: "Television", unitPriceMinor: 49900 },
};

export interface BasketLine {
  sku: string;
  qty: number;
  unitPriceMinor: number;
}

export function listCatalog(): CatalogItem[] {
  return Object.values(CATALOG).sort((a, b) => a.name.localeCompare(b.name));
}

export function getCatalogItem(sku: string): CatalogItem | undefined {
  return CATALOG[sku];
}

export function lineFromSku(sku: string, qty = 1): BasketLine {
  const item = CATALOG[sku];
  if (!item) throw new Error(`Unknown sku: ${sku}`);
  return { sku: item.sku, qty, unitPriceMinor: item.unitPriceMinor };
}

export function basketTotalMinor(basket: BasketLine[]): number {
  return basket.reduce((sum, line) => sum + line.qty * line.unitPriceMinor, 0);
}

export function formatMoneyMinor(minor: number, currency = "USD"): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  if (currency === "USD") return `${sign}$${major}.${cents}`;
  return `${sign}${major}.${cents} ${currency}`;
}

export function formatBasketLine(line: BasketLine): string {
  const item = CATALOG[line.sku];
  const name = item?.name ?? line.sku;
  return `${name} × ${line.qty} — ${formatMoneyMinor(line.qty * line.unitPriceMinor)}`;
}

/** Mutable cart helper for hosts / MCP Apps. */
export class Cart {
  private lines: BasketLine[] = [];

  addSku(sku: string, qty = 1): this {
    const line = lineFromSku(sku, qty);
    const existing = this.lines.find((l) => l.sku === sku);
    if (existing) existing.qty += qty;
    else this.lines.push(line);
    return this;
  }

  clear(): this {
    this.lines = [];
    return this;
  }

  toBasket(): BasketLine[] {
    return this.lines.map((l) => ({ ...l }));
  }

  totalMinor(): number {
    return basketTotalMinor(this.lines);
  }
}

/** Mock checkout — never charges a real card. */
export function mockCheckout(basket: BasketLine[]): {
  ok: true;
  receiptId: string;
  totalMinor: number;
} {
  return {
    ok: true,
    receiptId: `rcpt_${basket.map((l) => l.sku).join("_")}_${basketTotalMinor(basket)}`,
    totalMinor: basketTotalMinor(basket),
  };
}
