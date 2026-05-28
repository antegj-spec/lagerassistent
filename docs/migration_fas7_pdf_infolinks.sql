-- ============================================================
-- Migration: Fas 7 — PDF-bifogningar i INFO + PLAN→INFO-länkar
-- Kör i Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ---- 1. PDF-BIFOGNINGAR TILL INFO-ARTIKLAR ----

create table if not exists info_pdfs (
  id          bigserial primary key,
  article_id  bigint not null references info_articles(id) on delete cascade,
  pdf_url     text not null,
  pdf_name    text not null,
  uploaded_by text not null,
  created_at  timestamptz default now()
);

alter table info_pdfs enable row level security;

create policy "autentiserade kan läsa info_pdfs"
  on info_pdfs for select
  using (auth.role() = 'authenticated');

create policy "autentiserade kan lägga till info_pdfs"
  on info_pdfs for insert
  with check (auth.role() = 'authenticated');

create policy "autentiserade kan radera info_pdfs"
  on info_pdfs for delete
  using (auth.role() = 'authenticated');


-- ---- 2. UPPGIFT↔INFO-ARTIKEL-KOPPLINGAR ----

create table if not exists task_info_links (
  id               bigserial primary key,
  task_id          bigint not null references tasks(id) on delete cascade,
  info_article_id  bigint not null references info_articles(id) on delete cascade,
  created_by       text not null,
  created_at       timestamptz default now(),
  unique (task_id, info_article_id)
);

alter table task_info_links enable row level security;

create policy "autentiserade kan läsa task_info_links"
  on task_info_links for select
  using (auth.role() = 'authenticated');

create policy "autentiserade kan lägga till task_info_links"
  on task_info_links for insert
  with check (auth.role() = 'authenticated');

create policy "autentiserade kan radera task_info_links"
  on task_info_links for delete
  using (auth.role() = 'authenticated');


-- ---- 3. SUPABASE STORAGE BUCKET FÖR PDF:ER ----
-- Kör detta separat i SQL Editor eller via Supabase Dashboard → Storage → New bucket
-- Bucket-namn: lager-pdfs
-- Public: true (samma som lager-images)

insert into storage.buckets (id, name, public)
values ('lager-pdfs', 'lager-pdfs', true)
on conflict (id) do nothing;

create policy "Autentiserade kan ladda upp pdf"
  on storage.objects for insert
  with check (bucket_id = 'lager-pdfs' AND auth.role() = 'authenticated');

create policy "Alla kan läsa pdf"
  on storage.objects for select
  using (bucket_id = 'lager-pdfs');

create policy "Autentiserade kan radera pdf"
  on storage.objects for delete
  using (bucket_id = 'lager-pdfs' AND auth.role() = 'authenticated');
