# check-upcoming-deadlines

Edge Function som körs av pg_cron varje timme (`'5 * * * *'`).
Hittar tasks och notes med deadline 23-25h framåt och `push_sent_at IS NULL`,
skickar web-push till relevanta användare och markerar `push_sent_at=now()`.

## Deploy

```
supabase functions deploy check-upcoming-deadlines --project-ref tzidalknfoumoknhsetx
supabase secrets set \
  VAPID_PUBLIC_KEY='<public key>' \
  VAPID_PRIVATE_KEY='<private key>' \
  VAPID_SUBJECT='mailto:andreas.glad@eps.net' \
  --project-ref tzidalknfoumoknhsetx
```

## Manuell test (dry-run)

```
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}' \
  https://tzidalknfoumoknhsetx.functions.supabase.co/check-upcoming-deadlines
```

`dry_run=true` returnerar vad som SKULLE pushas (recipients, count) utan att skicka eller markera.

## Push-mottagare

- **Tasks:** `responsible` + alla i `assigned_to[]`
- **Notes:** `assigned_to` (single user)

## Idempotens

`push_sent_at` sätts på itemet efter första push. Återställs aldrig automatiskt — om deadline ändras (t.ex. flyttas fram), nollställ manuellt:

```sql
update tasks set push_sent_at = null where id = X;
update notes set push_sent_at = null where id = X;
```
