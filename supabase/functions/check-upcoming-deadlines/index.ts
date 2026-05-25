// ============================================================
// supabase/functions/check-upcoming-deadlines/index.ts  (Fas 6.1)
//
// Triggas av pg_cron varje timme (cron.schedule '5 * * * *').
// Hittar tasks + notes med deadline 23-25h framåt och push_sent_at
// IS NULL. Skickar web-push till alla relevanta användare (ansvarig +
// tilldelade) och markerar push_sent_at=now() så samma item inte
// pushas igen.
//
// Endpoint: POST /functions/v1/check-upcoming-deadlines
// Auth: x-cron-secret-header (samma som M4)
//
// Body (valfri):
//   { dry_run?: boolean } — om true, logga men skicka inte
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:andreas.glad@eps.net";

const supabase = createClient(SB_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface PushSubscriptionRow {
  id: number;
  user_name: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface TaskRow {
  id: number;
  title: string;
  deadline: string;
  responsible: string | null;
  assigned_to: string[] | null;
}

interface NoteRow {
  id: number;
  text: string;
  deadline: string;
  assigned_to: string | null;
}

// Skicka push till en subscription. Returnerar true vid framgång.
async function sendPush(sub: PushSubscriptionRow, payload: unknown): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (e: any) {
    // 404/410 = subscription utgången → radera
    const status = e?.statusCode || e?.status;
    if (status === 404 || status === 410) {
      await supabase.from("user_push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
    console.warn(`push to ${sub.user_name} failed (${status}):`, e?.message || e);
    return false;
  }
}

async function fetchSubsForUsers(users: string[]): Promise<PushSubscriptionRow[]> {
  if (!users.length) return [];
  const { data, error } = await supabase
    .from("user_push_subscriptions")
    .select("id, user_name, endpoint, p256dh, auth")
    .in("user_name", users);
  if (error) throw error;
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headerSecret = req.headers.get("x-cron-secret") || "";
  if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "VAPID keys ej konfigurerade" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
  } catch (e) { /* tomt body OK */ }

  // Tidsfönster: 23-25h framåt (±1h slack för cron-katchup)
  const now = new Date();
  const winStart = new Date(now.getTime() + 23 * 3600000).toISOString();
  const winEnd = new Date(now.getTime() + 25 * 3600000).toISOString();

  try {
    // ---- TASKS ----
    const { data: tasksRaw, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, deadline, responsible, assigned_to")
      .gte("deadline", winStart)
      .lte("deadline", winEnd)
      .is("push_sent_at", null)
      .is("deleted_at", null)
      .eq("archived", false)
      .neq("status", "klar");
    if (tErr) throw tErr;
    const tasks = (tasksRaw || []) as TaskRow[];

    // ---- NOTES ----
    const { data: notesRaw, error: nErr } = await supabase
      .from("notes")
      .select("id, text, deadline, assigned_to")
      .gte("deadline", winStart)
      .lte("deadline", winEnd)
      .is("push_sent_at", null)
      .is("deleted_at", null)
      .neq("status", "klar");
    if (nErr) throw nErr;
    const notes = (notesRaw || []) as NoteRow[];

    let pushesSent = 0;
    let itemsMarked = 0;
    const summary: Array<{ kind: string; id: number; recipients: string[]; sent: number }> = [];

    // ---- PROCESS TASKS ----
    for (const t of tasks) {
      const recipientSet = new Set<string>();
      if (t.responsible) recipientSet.add(t.responsible);
      (t.assigned_to || []).forEach((u) => recipientSet.add(u));
      const recipients = [...recipientSet];

      if (recipients.length === 0) {
        // Ingen att skicka till — markera ändå så vi inte plockar varje timme
        if (!dryRun) await supabase.from("tasks").update({ push_sent_at: new Date().toISOString() }).eq("id", t.id);
        summary.push({ kind: "task", id: t.id, recipients: [], sent: 0 });
        if (!dryRun) itemsMarked++;
        continue;
      }

      const subs = await fetchSubsForUsers(recipients);
      let sentForItem = 0;
      if (!dryRun) {
        for (const sub of subs) {
          const ok = await sendPush(sub, {
            title: "⏰ Deadline imorgon",
            body: t.title.substring(0, 100),
            url: "/",
            tag: `task-${t.id}`,
            kind: "task",
            id: t.id,
            urgent: true,
          });
          if (ok) sentForItem++;
        }
        await supabase.from("tasks").update({ push_sent_at: new Date().toISOString() }).eq("id", t.id);
        itemsMarked++;
      }
      pushesSent += sentForItem;
      summary.push({ kind: "task", id: t.id, recipients, sent: sentForItem });
    }

    // ---- PROCESS NOTES ----
    for (const n of notes) {
      const recipients = n.assigned_to ? [n.assigned_to] : [];

      if (recipients.length === 0) {
        if (!dryRun) await supabase.from("notes").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);
        summary.push({ kind: "note", id: n.id, recipients: [], sent: 0 });
        if (!dryRun) itemsMarked++;
        continue;
      }

      const subs = await fetchSubsForUsers(recipients);
      let sentForItem = 0;
      if (!dryRun) {
        for (const sub of subs) {
          const ok = await sendPush(sub, {
            title: "⏰ Deadline imorgon",
            body: n.text.substring(0, 100),
            url: "/",
            tag: `note-${n.id}`,
            kind: "note",
            id: n.id,
            urgent: false,
          });
          if (ok) sentForItem++;
        }
        await supabase.from("notes").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);
        itemsMarked++;
      }
      pushesSent += sentForItem;
      summary.push({ kind: "note", id: n.id, recipients, sent: sentForItem });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        window: { start: winStart, end: winEnd },
        items_marked: itemsMarked,
        pushes_sent: pushesSent,
        summary,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Failed: ${(e as Error).message}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
