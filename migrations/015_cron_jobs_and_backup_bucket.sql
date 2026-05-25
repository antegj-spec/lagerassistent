-- ============================================================
-- 015_cron_jobs_and_backup_bucket.sql  (Fas 6 Milstolpe 4)
--
-- Aktiverar pg_cron + pg_net och sätter upp 5 schemalagda jobb:
--  - 6.3:  Auto-arkivera klara tasks äldre än 30 dagar (dagligen 03:00 UTC)
--  - 6.4:  Tvätt → tillgänglig efter 7 dagar (dagligen 03:15 UTC)
--  - 6.14: Daglig JSON-backup till storage bucket (dagligen 02:00 UTC)
--         + backup-cleanup som raderar > 30d (dagligen 04:00 UTC)
--  - 6.15: Veckomail varje måndag 06:00 UTC (07:00 CET / 08:00 CEST)
--
-- IDEMPOTENT — cron.schedule ersätter ev. tidigare jobb med samma namn.
-- vault.create_secret är INTE idempotent — använd ON CONFLICT-pattern
-- (se nedan).
--
-- ============================================================
-- KRÄVS — kör DENNA SETUP FÖRST (engångsåtgärd)
-- ============================================================
--
-- STEG 1: Aktivera extensions via Supabase Dashboard:
--   Database → Extensions → enable 'pg_cron' (schema 'pg_catalog')
--                       → enable 'pg_net'
--                       → enable 'supabase_vault' (schema 'vault')
--
-- STEG 2: Lägg in secrets i Vault (SQL Editor — byt ut <CRON_SECRET>):
--
--   select vault.create_secret(
--     'https://tzidalknfoumoknhsetx.functions.supabase.co/daily-backup',
--     'backup_url',
--     'pg_cron daily-backup endpoint'
--   );
--   select vault.create_secret(
--     'https://lagerassistent.netlify.app/.netlify/functions/send-weekly',
--     'weekly_url',
--     'pg_cron send-weekly endpoint'
--   );
--   select vault.create_secret(
--     '<CRON_SECRET — samma som Netlify env-var>',
--     'cron_secret',
--     'Shared secret for cron-triggered endpoints'
--   );
--
-- STEG 3: Deploya Edge Function (terminal med Supabase CLI):
--   supabase functions deploy daily-backup --project-ref tzidalknfoumoknhsetx
--   supabase secrets set CRON_SECRET=<samma värde som Vault> \
--     --project-ref tzidalknfoumoknhsetx
--
-- STEG 4: Kör resten av denna fil (bucket + cron-jobs nedan).
-- ============================================================


-- ---- BACKUP-BUCKET ----
-- Skapar 'backups' om den inte finns. Privat (auth-only).
insert into storage.buckets (id, name, public)
  values ('backups', 'backups', false)
on conflict (id) do nothing;

-- RLS-policy: bara service-role får läsa/skriva (Edge Function använder
-- service-key). Användare har ingen direktåtkomst.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'backups_service_role_only'
  ) then
    create policy backups_service_role_only on storage.objects
      for all using (
        bucket_id = 'backups' and auth.role() = 'service_role'
      );
  end if;
end$$;


-- ============================================================
-- VAULT-HJÄLPARE
-- ============================================================
-- pg_cron-jobben behöver läsa Vault-secrets. vault.decrypted_secrets
-- är en view tillgänglig för 'postgres'-rollen som pg_cron kör som.
-- Wrapper-funktion gör cron-SQL-syntaxen kortare.

create or replace function public.cron_secret(secret_name text)
returns text
language sql
security definer
set search_path = vault, public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;


-- ---- 6.3: AUTO-ARKIVERA KLARA TASKS > 30 DAGAR ----
-- Kör dagligen 03:00 UTC. Sätter archived=true på tasks med
-- status='klar' OCH updated_at äldre än 30 dagar.

select cron.schedule(
  'auto-archive-tasks',
  '0 3 * * *',
  $$
    update tasks
    set archived = true,
        updated_at = now()
    where status = 'klar'
      and archived = false
      and updated_at < now() - interval '30 days'
      and deleted_at is null;
  $$
);


-- ---- 6.4: TVÄTT → TILLGÄNGLIG EFTER 7 DAGAR ----
-- Kör dagligen 03:15 UTC. Flyttar material_items.status='tvätt' →
-- 'tillgänglig' när updated_at är äldre än 7 dagar. Sätter last_washed=now()
-- och loggar till material_history med changed_by='system'.

select cron.schedule(
  'auto-flytta-tvatt',
  '15 3 * * *',
  $$
    with flipped as (
      update material_items
      set status = 'tillgänglig',
          last_washed = now(),
          updated_at = now()
      where status = 'tvätt'
        and updated_at < now() - interval '7 days'
      returning id, material_id, article_id
    )
    insert into material_history
      (material_id, item_id, article_id, old_status, new_status, changed_by, created_at)
    select material_id, id, article_id, 'tvätt', 'tillgänglig', 'system', now()
    from flipped;
  $$
);


-- ---- 6.14: DAGLIG BACKUP ----
-- Kör dagligen 02:00 UTC. Triggar Edge Function via pg_net.

select cron.schedule(
  'daily-backup',
  '0 2 * * *',
  $$
    select net.http_post(
      url := public.cron_secret('backup_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.cron_secret('cron_secret')
      ),
      body := jsonb_build_object('triggered_at', now()::text)
    ) as request_id;
  $$
);

-- Backup-rotation: radera filer äldre än 30 dagar (kör dagligen 04:00 UTC).
select cron.schedule(
  'backup-cleanup',
  '0 4 * * *',
  $$
    delete from storage.objects
    where bucket_id = 'backups'
      and created_at < now() - interval '30 days';
  $$
);


-- ---- 6.15: VECKOMAIL (måndag morgon) ----

select cron.schedule(
  'send-weekly-mail',
  '0 6 * * 1',  -- måndag 06:00 UTC = 07:00 CET / 08:00 CEST
  $$
    select net.http_post(
      url := public.cron_secret('weekly_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', public.cron_secret('cron_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);


-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. Vault-secrets på plats?
--    select name, description from vault.decrypted_secrets
--      where name in ('backup_url', 'weekly_url', 'cron_secret');
--    -- (decrypted_secret syns när rad är expanded — visa inte i kopia)
--
-- 2. Schemalagda jobb?
--    select jobid, schedule, jobname, active from cron.job
--      where jobname in ('auto-archive-tasks', 'auto-flytta-tvatt',
--                        'daily-backup', 'backup-cleanup', 'send-weekly-mail');
--
-- 3. Manuell test av backup-flödet (utan att vänta till 02:00):
--    select net.http_post(
--      url := (select decrypted_secret from vault.decrypted_secrets where name = 'backup_url'),
--      headers := jsonb_build_object(
--        'Content-Type', 'application/json',
--        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
--      ),
--      body := '{}'::jsonb
--    );
--    -- Returnerar ett request_id (integer). Vänta ~5s, kolla sen
--    -- HTTP-svaret (cron.job_run_details är BARA för cron-triggade
--    -- körningar — manuell anrop hamnar inte där):
--    select id, status_code, content::text, created
--      from net._http_response
--      order by created desc limit 3;
--    -- Förväntat: status_code=200, content innehåller {"ok":true,...}
--
-- 4. Cron-triggade körningar (efter att jobben hunnit köras minst en gång):
--    select j.jobname, d.status, d.return_message, d.start_time
--      from cron.job_run_details d
--      join cron.job j on j.jobid = d.jobid
--      where j.jobname in ('auto-archive-tasks', 'auto-flytta-tvatt',
--                          'daily-backup', 'backup-cleanup', 'send-weekly-mail')
--      order by d.start_time desc limit 10;
--
-- 5. Lista backup-filer i bucket:
--    select name, created_at, metadata->>'size' as bytes
--      from storage.objects where bucket_id = 'backups'
--      order by created_at desc limit 10;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Avschemalägg alla jobb:
--   select cron.unschedule('auto-archive-tasks');
--   select cron.unschedule('auto-flytta-tvatt');
--   select cron.unschedule('daily-backup');
--   select cron.unschedule('backup-cleanup');
--   select cron.unschedule('send-weekly-mail');
--
-- Ta bort wrapper-funktion:
--   drop function if exists public.cron_secret(text);
--
-- Ta bort Vault-secrets (om återkalla helt):
--   delete from vault.secrets where name in ('backup_url', 'weekly_url', 'cron_secret');
--
-- Ta bort backup-bucket (tom först!):
--   delete from storage.objects where bucket_id = 'backups';
--   delete from storage.buckets where id = 'backups';
--   drop policy if exists backups_service_role_only on storage.objects;
