-- ============================================================
-- 033_login_throttle.sql  (Säkerhetshärdning H3 — per-IP rate limit)
--
-- Per-konto-lockout (5 fel → 5 min, i verify-pin) stoppar inte en angripare
-- som sprider gissningar över FLERA konton från samma IP. Denna tabell låter
-- verify-pin räkna inloggningsförsök per IP i ett glidande fönster och blocka
-- oavsett vilket konto som testas.
--
-- Endast service-role (verify-pin) rör tabellen → RLS på utan policies.
--
-- OBS: alla 5 användare kan dela samma kontors-IP. Tröskeln i verify-pin
-- (IP_THRESHOLD) är satt generöst (30 / 15 min) så normal användning inte
-- träffas. Justera där vid behov.
--
-- IDEMPOTENT.
-- ============================================================

create table if not exists login_attempts (
  id           bigint generated always as identity primary key,
  ip           text not null,
  user_name    text,
  success      boolean not null default false,
  attempted_at timestamptz not null default now()
);

-- Index för fönsterfrågan (ip + tid).
create index if not exists idx_login_attempts_ip_time
  on login_attempts (ip, attempted_at desc);

-- RLS på, inga policies → bara service-role (verify-pin) kommer åt.
alter table login_attempts enable row level security;

-- ============================================================
-- VERIFIKATION
-- ============================================================
-- 1. Som anonym/authenticated:
--    select * from login_attempts;   -- ska ge 0 rader (RLS, ingen policy)
-- 2. Efter några inloggningsförsök (service-role-vy / Edge Function-logg):
--    select ip, count(*) from login_attempts
--      where attempted_at > now() - interval '15 min' group by ip;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop table if exists login_attempts;
