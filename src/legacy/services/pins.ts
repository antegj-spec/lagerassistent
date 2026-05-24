// ============================================================
// services/pins.ts — PIN-byte och PIN-create (verify-PIN sker i Edge Function)
// Beror på: config.ts, supabase.ts (sb)
// ============================================================

interface ChangePinResponse {
  ok?: boolean;
  error?: string;
  [k: string]: unknown;
}

async function changePinViaEdge(currentPin: string, newPin: string): Promise<ChangePinResponse> {
  const token = sessionStorage.getItem("lager-token");
  if (!token) throw new Error("Not logged in");
  const r = await fetch(SB_URL + "/functions/v1/change-pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SB_KEY,
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  });
  const data: ChangePinResponse = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Kunde inte byta PIN");
  return data;
}

async function savePin(userName: string, pin: string, isSet: boolean = true): Promise<void> {
  try {
    await sb("/rest/v1/user_pins?user_name=eq." + encodeURIComponent(userName), {
      method: "PATCH",
      body: JSON.stringify({ pin, pin_set: isSet, updated_at: new Date().toISOString() }),
      prefer: "return=minimal"
    });
  } catch (e) {}
  try {
    await sb("/rest/v1/user_pins", {
      method: "POST",
      body: JSON.stringify({ user_name: userName, pin, pin_set: isSet }),
      prefer: "return=minimal,resolution=merge-duplicates"
    });
  } catch (e) {}
}
