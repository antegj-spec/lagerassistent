// ============================================================
// supabase/functions/daily-backup/index.ts  (Fas 6.14)
//
// Triggas av pg_cron-job 'daily-backup' (kl 02:00 UTC).
// Läser alla tabeller via service-role och laddar upp en JSON-dump
// till storage-bucket 'backups' med filnamn YYYY-MM-DD.json.
//
// Endpoint: POST /functions/v1/daily-backup
// Auth: x-cron-secret-header som matchar env CRON_SECRET
//
// Returns:
//   200 { ok: true, filename, bytes, counts: {...} }
//   401 { error: "Unauthorized" }
//   500 { error: "Backup failed: ..." }
//
// Tabeller som inkluderas (alla utom user_pins.pin_hash):
//   notes, comments
//   materials_v2, material_items, material_counts, material_history,
//   material_comments, material_images, material_item_images,
//   borrowed_material
//   tasks, task_status_log, task_comments, task_checklist
//   info_articles, info_images, info_comments
//   returns
//   user_pins (UTAN pin_hash), user_roles
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const supabase = createClient(SB_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tabeller som dumpas. Strängar = direkta SELECT *.
const TABLES = [
  "notes",
  "comments",
  "materials_v2",
  "material_items",
  "material_counts",
  "material_history",
  "material_comments",
  "material_images",
  "material_item_images",
  "borrowed_material",
  "tasks",
  "task_status_log",
  "task_comments",
  "task_checklist",
  "info_articles",
  "info_images",
  "info_comments",
  "returns",
  "user_roles",
];

// user_pins: hämta bara meta (inte pin_hash) av säkerhetsskäl
async function fetchUserPinsSafe(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("user_pins")
    .select("id, user_name, pin_set, locked_until, failed_attempts, created_at, updated_at");
  if (error) throw new Error(`user_pins: ${error.message}`);
  return data || [];
}

async function fetchTable(name: string): Promise<unknown[]> {
  const { data, error } = await supabase.from(name).select("*");
  if (error) throw new Error(`${name}: ${error.message}`);
  return data || [];
}

function datestamp(): string {
  // YYYY-MM-DD i UTC (matchar cron-tidszonen)
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

Deno.serve(async (req) => {
  // Endast POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth: x-cron-secret
  const headerSecret = req.headers.get("x-cron-secret") || "";
  if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const tables: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    // Hämta alla tabeller parallellt
    const fetched = await Promise.all([
      ...TABLES.map(async (t) => ({ name: t, rows: await fetchTable(t) })),
      fetchUserPinsSafe().then((rows) => ({ name: "user_pins", rows })),
    ]);

    for (const { name, rows } of fetched) {
      tables[name] = rows;
      counts[name] = rows.length;
    }

    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      counts,
      tables,
    };

    const body = new TextEncoder().encode(JSON.stringify(payload));
    const filename = `${datestamp()}.json`;

    // Ladda upp till bucket 'backups'. upsert=true så samma dag skriver över
    // tidigare backup samma dygn (förhindrar duplikat vid retry).
    const { error: upErr } = await supabase.storage
      .from("backups")
      .upload(filename, body, {
        contentType: "application/json",
        upsert: true,
      });

    if (upErr) throw new Error(`upload: ${upErr.message}`);

    return new Response(
      JSON.stringify({
        ok: true,
        filename,
        bytes: body.length,
        counts,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Backup failed: ${(e as Error).message}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
