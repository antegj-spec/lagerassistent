# daily-backup

Edge Function som körs av pg_cron-job (`cron.daily-backup`) varje dygn
kl 02:00 UTC. Skapar JSON-dump av alla tabeller och laddar upp till
storage-bucket `backups/YYYY-MM-DD.json`.

## Deploy

```
supabase functions deploy daily-backup --project-ref tzidalknfoumoknhsetx
```

## Env vars (sätts via Supabase Dashboard → Edge Functions → daily-backup → Secrets)

- `SUPABASE_URL` — auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected
- `CRON_SECRET` — samma som Netlify (slumpmässig sträng, måste matcha
  `cron.cron_secret` i pg_cron-konfig)

## Manuell test

```
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  https://tzidalknfoumoknhsetx.functions.supabase.co/daily-backup
```

## Rotation

Backuper äldre än 30 dagar tas bort av separat pg_cron-jobb
`backup-cleanup` (kör 04:00 UTC).
