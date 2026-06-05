// ============================================================
// services/cars.ts — Bilregister + körjournal (Fas 8 Etapp B)
// Beror på: store.ts, supabase.ts (sb)
// ============================================================

async function loadCars(): Promise<void> {
  try {
    cars.list = await sb<Car[]>("/rest/v1/cars?order=reg_nr.asc") || [];
  } catch (e) {
    console.error("loadCars failed:", e);
  }
}

async function loadCarTrips(): Promise<void> {
  try {
    cars.trips = await sb<CarTrip[]>(
      "/rest/v1/car_trips?order=trip_date.desc,odometer_start.desc"
    ) || [];
  } catch (e) {
    console.error("loadCarTrips failed:", e);
  }
}

async function saveCar(c: Partial<Car> & { id?: string }): Promise<string | undefined> {
  const { id, created_at, ...b } = c as Partial<Car>;
  if (id) {
    await sb("/rest/v1/cars?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify(b),
      prefer: "return=minimal"
    });
    return id;
  } else {
    const res = await sb<{ id: string }[]>("/rest/v1/cars", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return res?.[0]?.id;
  }
}

async function delCar(id: string): Promise<void> {
  await sb("/rest/v1/cars?id=eq." + id, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}

async function saveCarTrip(t: Partial<CarTrip> & { id?: string }): Promise<string | undefined> {
  const { id, created_at, ...b } = t as Partial<CarTrip>;
  if (id) {
    // return=representation så vi ser om en rad faktiskt ändrades. Om RLS
    // filtrerar bort raden uppdateras 0 rader och PostgREST svarar [] (inte
    // ett fel) — utan denna koll maskeras det som en lyckad "avsluta resa".
    const res = await sb<CarTrip[]>("/rest/v1/car_trips?id=eq." + id, {
      method: "PATCH",
      body: JSON.stringify({ ...b, updated_at: new Date().toISOString() }),
      prefer: "return=representation"
    });
    if (!res || res.length === 0) {
      throw new Error("ingen rad ändrades — du saknar troligen behörighet eller så finns resan inte längre");
    }
    return id;
  } else {
    const res = await sb<{ id: string }[]>("/rest/v1/car_trips", {
      method: "POST",
      body: JSON.stringify(b),
      headers: { "Prefer": "return=representation" }
    });
    return res?.[0]?.id;
  }
}

async function delCarTrip(id: string): Promise<void> {
  await sb("/rest/v1/car_trips?id=eq." + id, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}
