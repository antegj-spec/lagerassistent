import { beforeAll, describe, expect, it } from "vitest";
import { loadLegacy } from "./helpers/loadLegacy";

// Ladda den riktiga, transpilerade källan (ingen duplicerad logik).
let calc: Record<string, any>;
beforeAll(() => {
  calc = loadLegacy(["lib/calc.ts"]);
});

// Minimal trip-fabrik — bara fälten calc-funktionerna bryr sig om.
function trip(over: Partial<{
  id: string; car_id: string; trip_date: string;
  odometer_start: number; odometer_end: number;
}> = {}) {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    car_id: over.car_id ?? "bil-1",
    trip_date: over.trip_date ?? "2026-01-01",
    odometer_start: over.odometer_start ?? 0,
    odometer_end: over.odometer_end ?? 0,
  };
}

// Normalisera tusentalsavgränsare (ICU kan ge   eller  ).
const norm = (s: string) => s.replace(/[  \s]/g, " ");

describe("detectTripGaps", () => {
  it("returnerar inga luckor när resorna är sammanhängande", () => {
    const trips = [
      trip({ trip_date: "2026-01-01", odometer_start: 100, odometer_end: 150 }),
      trip({ trip_date: "2026-01-02", odometer_start: 150, odometer_end: 200 }),
    ];
    expect(calc.detectTripGaps(trips)).toEqual([]);
  });

  it("hittar en lucka när nästa resa börjar högre än föregående slutade", () => {
    const trips = [
      trip({ trip_date: "2026-01-01", odometer_start: 100, odometer_end: 150 }),
      trip({ trip_date: "2026-01-02", odometer_start: 175, odometer_end: 200 }),
    ];
    const gaps = calc.detectTripGaps(trips);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gap_km).toBe(25);
    expect(gaps[0].prev.odometer_end).toBe(150);
    expect(gaps[0].next.odometer_start).toBe(175);
  });

  it("ignorerar överlapp/negativ differens (inte en saknad-km-lucka)", () => {
    const trips = [
      trip({ trip_date: "2026-01-01", odometer_start: 100, odometer_end: 150 }),
      trip({ trip_date: "2026-01-02", odometer_start: 140, odometer_end: 200 }),
    ];
    expect(calc.detectTripGaps(trips)).toEqual([]);
  });

  it("sorterar kronologiskt innan jämförelse (osorterad input)", () => {
    const trips = [
      trip({ trip_date: "2026-01-03", odometer_start: 300, odometer_end: 350 }),
      trip({ trip_date: "2026-01-01", odometer_start: 100, odometer_end: 150 }),
      trip({ trip_date: "2026-01-02", odometer_start: 150, odometer_end: 250 }),
    ];
    // 150→150 (ok), 250→300 (lucka 50)
    const gaps = calc.detectTripGaps(trips);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gap_km).toBe(50);
  });

  it("samma dag: sorterar sekundärt på odometer_start", () => {
    const trips = [
      trip({ trip_date: "2026-01-01", odometer_start: 200, odometer_end: 250 }),
      trip({ trip_date: "2026-01-01", odometer_start: 100, odometer_end: 200 }),
    ];
    expect(calc.detectTripGaps(trips)).toEqual([]);
  });

  it("hanterar tom lista och enskild resa", () => {
    expect(calc.detectTripGaps([])).toEqual([]);
    expect(calc.detectTripGaps([trip()])).toEqual([]);
  });

  it("muterar inte input-arrayen", () => {
    const trips = [
      trip({ trip_date: "2026-01-02", odometer_start: 150, odometer_end: 200 }),
      trip({ trip_date: "2026-01-01", odometer_start: 100, odometer_end: 150 }),
    ];
    const before = trips.map((t) => t.trip_date);
    calc.detectTripGaps(trips);
    expect(trips.map((t) => t.trip_date)).toEqual(before);
  });
});

describe("tripDistance", () => {
  it("räknar körd sträcka", () => {
    expect(calc.tripDistance({ odometer_start: 1000, odometer_end: 1042 })).toBe(42);
  });
  it("ger 0 när start = slut", () => {
    expect(calc.tripDistance({ odometer_start: 500, odometer_end: 500 })).toBe(0);
  });
});

describe("ecoSumByCategory", () => {
  it("summerar per kategori", () => {
    const entries = [
      { category: "verktyg", price: 100 },
      { category: "verktyg", price: 50 },
      { category: "förbrukning", price: 25 },
    ];
    expect(calc.ecoSumByCategory(entries)).toEqual({ verktyg: 150, "förbrukning": 25 });
  });

  it("coercar sträng-priser till tal (inte konkatenering)", () => {
    const entries = [
      { category: "a", price: "100" },
      { category: "a", price: "50" },
    ];
    expect(calc.ecoSumByCategory(entries)).toEqual({ a: 150 });
  });

  it("ger tomt objekt för tom lista", () => {
    expect(calc.ecoSumByCategory([])).toEqual({});
  });
});

describe("ecoTotal", () => {
  it("summerar alla poster", () => {
    expect(calc.ecoTotal([{ price: 100 }, { price: 200 }, { price: 5.5 }])).toBe(305.5);
  });
  it("ger 0 för tom lista", () => {
    expect(calc.ecoTotal([])).toBe(0);
  });
  it("coercar sträng-priser", () => {
    expect(calc.ecoTotal([{ price: "100" }, { price: "200" }])).toBe(300);
  });
});

describe("formatSek", () => {
  it("avrundar till heltal kronor", () => {
    expect(norm(calc.formatSek(2557.88))).toBe("2 558 kr");
    expect(norm(calc.formatSek(2557.12))).toBe("2 557 kr");
  });
  it("lägger tusentalsavgränsare", () => {
    expect(norm(calc.formatSek(11116))).toBe("11 116 kr");
  });
  it("hanterar 0", () => {
    expect(calc.formatSek(0)).toBe("0 kr");
  });
});
