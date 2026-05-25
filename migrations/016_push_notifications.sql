-- ============================================================
-- 016_push_notifications.sql  (Fas 6 Milstolpe 5 — Web Push)
--
-- Sätter upp:
--  - user_push_subscriptions: per-användares browser-subscriptions
--  - tasks.push_sent_at, notes.push_sent_at: idempotens-marker så
--    samma deadline-påminnelse inte skickas flera gånger
--  - pg_cron-jobb 'check-upcoming-deadlines' som varje timme triggar
--    Edge Function 'check-upcoming-deadlines' via pg_net
--
-- KRÄVER att Fas 6 M4 (migration 015) körts först — vault-secrets +
-- pg_cron + pg_net + public.cron_secret() återanvänds.
--
-- ============================================================
-- KRÄVS — kör DENNA SETUP FÖRST (engångsåtgärd)
-- ============================================================
--
-- STEG 1: Generera VAPID-nyckelpar lokalt (en gång):
--   npx web-push generate-vapid-keys
--
--   Output:
--     Public Key:  BL...
--     Private Key: ...
--
-- STEG 2: Lägg in publika nyckeln + URL i Vault:
--   select vault.create_secret(
--     '<PUBLIC_KEY från npx-output>',
--     'vapid_public_key',
--     'Web push VAPID public key (delas med klienter)'
--   );
--   select vault.create_secret(
--     'https://tzidalknfoumoknhsetx.functions.supabase.co/check-upcoming-deadlines',
--     'check_deadlines_url',
--     'pg_cron deadline-checker endpoint'
--   );
--
-- STEG 3: Deploya 4 Edge Functions (terminal):
--   supabase functions deploy get-vapid-public-key       --project-ref tzidalknfoumoknhsetx
--   supabase functions deploy save-push-subscription     --project-ref tzidalknfoumoknhsetx
--   supabase functions deploy send-push                  --project-ref tzidalknfoumoknhsetx
--   supabase functions deploy check-upcoming-deadlines   --project-ref tzidalknfoumoknhsetx
--
--   Lägg secrets på Edge Functions:
--     supabase secrets set \
--       VAPID_PUBLIC_KEY='<PUBLIC_KEY>' \
--       VAPID_PRIVATE_KEY='<PRIVATE_KEY>' \
--       VAPID_SUBJECT='mailto:andreas.glad@eps.net' \
--       --project-ref tzidalknfoumoknhsetx
--     (CRON_SECRET finns redan från M4)
--
-- STEG 4: Kör resten av denna fil.
-- ============================================================


-- ---- USER_PUSH_SUBSCRIPTIONS ----
-- En rad per browser-installation som har opt-in:at push.
create table if not exists user_push_subscriptions (
  id              bigserial primary key,
  user_name       text not null,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz not null default now()
);

create index if not exists idx_user_push_subscriptions_user
  on user_push_subscriptions (user_name);

-- RLS: användaren får läsa/skriva sina egna subscriptions.
-- Edge Function 'send-push' använder service-role och bypassar RLS.
alter table user_push_subscriptions enable row level security;

drop policy if exists "push_subs_select_own" on user_push_subscriptions;
create policy "push_subs_select_own" on user_push_subscriptions
  for select using (user_name = current_user_name());

drop policy if exists "push_subs_insert_own" on user_push_subscriptions;
create policy "push_subs_insert_own" on user_push_subscriptions
  for insert with check (user_name = current_user_name());

drop policy if exists "push_subs_delete_own" on user_push_subscriptions;
create policy "push_subs_delete_own" on user_push_subscriptions
  for delete using (user_name = current_user_name());

drop policy if exists "push_subs_update_own" on user_push_subscriptions;
create policy "push_subs_update_own" on user_push_subscriptions
  for update using (user_name = current_user_name());


-- ---- IDEMPOTENS-KOLUMNER ----
-- push_sent_at: tidsstämpel när 24h-påminnelse skickats. NULL = ej skickad.
-- check-upcoming-deadlines markerar NULL→now() efter lyckad push så
-- raden inte plockas igen vid nästa timme.

alter table tasks
  add column if not exists push_sent_at timestamptz;

alter table notes
  add column if not exists push_sent_at timestamptz;


-- ---- CRON-JOBB: HOURLY DEADLINE-CHECK ----
-- Triggar Edge Function 'check-upcoming-deadlines' varje timme.
-- Funktionen hittar tasks + notes med deadline 23-25h framåt och
-- push_sent_at IS NULL, skickar push till relevanta användare, och
-- markerar push_sent_at=now() för att förhindra duplikat.

select cron.schedule(
  'check-upcoming-deadlines',
  '5 * * * *',  -- varje timme, 5 min över (efter ev. cron-katchup)
  $$
    select net.http_post(
      url := public.cron_secret('check_deadlines_url'),
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
-- 1. Tabell + kolumner:
--    select column_name, data_type from information_schema.columns
--      where table_name = 'user_push_subscriptions';
--    select column_name from information_schema.columns
--      where table_name in ('tasks', 'notes') and column_name = 'push_sent_at';
--
-- 2. Cron-jobbet:
--    select jobid, schedule, jobname, active from cron.job
--      where jobname = 'check-upcoming-deadlines';
--
-- 3. Manuell trigger av deadline-check:
--    select net.http_post(
--      url := (select decrypted_secret from vault.decrypted_secrets where name = 'check_deadlines_url'),
--      headers := jsonb_build_object(
--        'Content-Type', 'application/json',
--        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
--      ),
--      body := '{}'::jsonb
--    );
--    -- HTTP-svar:
--    select id, status_code, content::text from net._http_response
--      order by created desc limit 1;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- select cron.unschedule('check-upcoming-deadlines');
-- alter table tasks drop column if exists push_sent_at;
-- alter table notes drop column if exists push_sent_at;
-- drop table if exists user_push_subscriptions cascade;
-- delete from vault.secrets where name in ('vapid_public_key', 'check_deadlines_url');
