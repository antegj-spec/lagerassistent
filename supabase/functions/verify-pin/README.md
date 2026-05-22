# verify-pin Edge Function

Server-side PIN-verifiering med bcrypt, lockout och Supabase Auth session-utfärdande.

## Deploy (manuellt via Dashboard — Supabase CLI ej använt)

Eftersom projektet inte har Supabase CLI installerad kör vi via Dashboard:

1. Öppna **Supabase Dashboard → Edge Functions → Create function**
2. Namn: `verify-pin`
3. Klistra in hela innehållet i `index.ts`
4. Klicka **Deploy function**
5. Verifiera att den syns under Functions med status "Active"

## Test (efter deploy)

I terminalen (byt ut `<ANON_KEY>` mot anon-key från Supabase Dashboard → API):

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/verify-pin \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -d '{"user_name":"Admin","pin":"0987"}'
```

**Förväntat OK-svar:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "...",
  "expires_at": 1234567890,
  "user_name": "Admin",
  "role": "admin"
}
```

**Förväntat fel-svar (fel PIN):**
```json
{ "error": "Invalid credentials" }
```

## Env vars (sätts automatiskt av Supabase)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Inga manuella env vars behövs.

## CORS

Tillåtna origins är hårdkodade i `index.ts`. Uppdatera ALLOWED_ORIGINS om
din Netlify-domän inte är `lagerassistent.netlify.app`.
