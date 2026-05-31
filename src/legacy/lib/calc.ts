// ============================================================
// lib/calc.ts — Rena beräkningar utan sidoeffekter.
// Inga globala beroenden (state, DOM, nätverk) → kan enhetstestas
// isolerat (test/calc.test.ts). Global scope (module:"none"), så
// app-koden anropar dem direkt som vanliga funktioner.
// ============================================================

// ---- KÖRJOURNAL ----

interface TripGap {
  car_id: string;
  prev: CarTrip;
  next: CarTrip;
  gap_km: number;
}

// Luckor per bil där en resa börjar högre än föregående slutade
// (= körda km som saknas i journalen). Sorterar kronologiskt
// (datum, sedan odometer_start) innan intilliggande rader jämförs.
function detectTripGaps(tripsForCar: CarTrip[]): TripGap[] {
  // Öppna (pågående) resor saknar odometer_end → ingår inte i kedjan.
  const sorted = tripsForCar
    .filter(t => t.odometer_end != null)
    .sort((a, b) => {
      if (a.trip_date < b.trip_date) return -1;
      if (a.trip_date > b.trip_date) return 1;
      return a.odometer_start - b.odometer_start;
    });
  const gaps: TripGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const diff = next.odometer_start - (prev.odometer_end as number);
    if (diff > 0) {
      gaps.push({ car_id: next.car_id, prev, next, gap_km: diff });
    }
  }
  return gaps;
}

// Körd sträcka för en resa. Öppen resa (odometer_end null) → 0.
function tripDistance(t: { odometer_start: number; odometer_end: number | null }): number {
  return t.odometer_end == null ? 0 : t.odometer_end - t.odometer_start;
}

// ---- EKONOMI ----

// Summa per kategori-id (i kronor, ej avrundat — formateras vid visning).
function ecoSumByCategory(entries: EconomyEntry[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const e of entries) {
    sums[e.category] = (sums[e.category] || 0) + Number(e.price);
  }
  return sums;
}

// Total över alla poster.
function ecoTotal(entries: EconomyEntry[]): number {
  return entries.reduce((acc, e) => acc + Number(e.price), 0);
}

// SEK-formatering: 11116 → "11 116 kr", 2557.88 → "2 558 kr" (avrundat).
function formatSek(n: number): string {
  const rounded = Math.round(Number(n));
  return rounded.toLocaleString("sv-SE") + " kr";
}
