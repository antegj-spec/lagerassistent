# Guide för Claude — arbete med info-dokument

Den här filen är instruktionen Claude följer när användaren vill skapa eller
redigera dokument som senare läggs in i info-fliken.

**Användarens kortkommando till nästa session:** *"Läs `docs/info/CLAUDE-GUIDE.md`
och fortsätt jobba enligt det. Jag vill skapa/ändra dokument om X."*

---

## Bakgrund — vad är detta?

Info-fliken i Lagerassistent har artiklar grupperade i tre kategorier:
**Utrustning**, **Maskiner**, **Rutiner**. Varje artikel består av en rubrik,
en kort beskrivning (visas i listan) och en eller flera bifogade PDF:er med
djupgående info.

Vi producerar dessa dokument utanför appen — som `.md`-källor som vi
redigerar iterativt — och genererar PDF från dem. Användaren laddar sedan upp
PDF:en manuellt i info-fliken och fyller i `title` + `category` +
`short_description` från frontmattern.

## Mappstruktur

```
docs/info/
├── CLAUDE-GUIDE.md          ← den här filen
├── README.md                ← snabbstart för människor
├── _templates/
│   ├── utrustning.md
│   ├── maskin.md
│   └── rutin.md
└── <kategori>/<slug>/
    ├── <slug>.md            ← källa, det vi redigerar tillsammans
    └── <slug>.pdf           ← genereras från .md
```

Kategori-mappar: `utrustning/`, `maskiner/`, `rutiner/` (gemener,
plural-mappar matchar inte exakt category-värdet i frontmatter — det är okej,
det är bara filsystem).

## Frontmatter — det som synkar till hemsidan

Varje `.md` börjar med en YAML-block. Detta är **källan** för det som hamnar
i Supabase-tabellen `info_articles` när användaren skapar artikeln i appen:

```yaml
---
title: "..."                  → info_articles.title
category: "Utrustning"        → info_articles.category (enum: Utrustning|Maskiner|Rutiner)
short_description: "..."      → info_articles.body (det som syns i listan)
slug: "..."                   → används för mapp/filnamn, ej i db
last_updated: "YYYY-MM-DD"    → ej i db, för vår spårning
---
```

PDF:en bifogas separat i appen via "Lägg till PDF"-knappen på artikeln
(`info_pdfs`-tabellen).

## Workflow när användaren ber om något

### Nytt dokument

1. **Snabb intake.** Bara det du inte kan gissa — fråga via vanlig text
   (inte AskUserQuestion om svaret är uppenbart från sammanhanget):
   - Kategori (om inte uppenbart från ämnet)
   - Titel (om bara ett ämne nämnts)
2. **Skapa mappen** `docs/info/<kategori>/<slug>/` och kopiera rätt mall till
   `<slug>.md`.
3. **Fyll i frontmattern** + det användaren redan sagt, på rätt sektioner.
4. **Markera luckor** med `*[Att fylla i — vad som behövs]*` så vi ser var
   info saknas.
5. **Rapportera kort** vad som lagts in och vilka luckor som finns.

### Redigering ("lägg till X under Y", "ändra Z")

1. **Använd Edit-verktyget** för precisa byten — inte Write som rewrite.
   Det gör diffen läsbar och undviker att andra delar förändras av misstag.
2. När användaren ger info som hör hemma på flera ställen — uppdatera alla
   relevanta sektioner i samma sväng (t.ex. "trucken lyfter lodrätt" påverkar
   både *Truck/transport*, *Steg-för-steg* och *Tekniska noteringar*).
3. **Rätta uppenbara typos diskret** men flagga det i svaret så användaren
   kan korrigera om jag tolkat fel. (Exempel från ALP-sessionen: "börja" →
   "böja" där sammanhanget gjorde det entydigt.)
4. **Anpassa mallen** när sektioner inte passar. Mallen är en startpunkt,
   inte ett krav. För reparationsarbete togs t.ex. *Förpackningsform* bort
   och *Färdig pall* bytte namn till *Slutkontroll*.

### Generera PDF

```bash
python tools/md-to-pdf/build.py docs/info/<kategori>/<slug>/<slug>.md
```

PDF:en hamnar bredvid `.md`-filen. Frontmattern renderas som ett meta-block
överst.

Beroenden (engångsinstall): `pip install -r tools/md-to-pdf/requirements.txt`
(reportlab + pyyaml + markdown-it-py).

Generera bara när användaren ber om det eller när dokumentet uppenbart är
i klart-läge. Inte efter varje liten ändring.

### Word-fil (.docx)

Skapas bara på begäran. Vi har ingen automatisk generator för det än —
fråga användaren om det behövs när det väl efterfrågas.

## Tonläge och språk

- Svenska.
- Korta, konkreta meningar. Detta är referensmaterial som folk läser i
  lagermiljö, inte en uppsats.
- **Inga emojis** i dokumentinnehållet.
- **Inga bilder** — markeras "*[Bild läggs till senare]*" där det passar.
  Användaren lägger till bilder manuellt senare via appen.

## Mönster som visat sig användbara

### Zonindelade steg-för-steg

När arbetet sker över flera fysiska zoner (inkommande → arbetsstation →
färdig) — gruppera stegen per zon och tillåt överlapp där moment kan
parallelliseras över flera enheter. Se ALP-dokumentet som exempel.

### Tabell för felsökning

`maskin.md`-mallen har en `| Symptom | Trolig orsak | Åtgärd |`-tabell.
Användbart för maskiner. Behöver inte fyllas i direkt — kan börja tomt och
växa.

### Checklistor vs. steg-för-steg

I rutin-dokument: håll dem separata. **Steg-för-steg** är *hur* man gör.
**Checklista** är *vad man kollar av* i stunden. Användbart att ha båda när
en rutin har många moment.

### Roller före antal personer

Sektionen *Bemanning* fungerar bäst med tydlig rollindelning (vem gör vad)
snarare än bara ett antal. Skalbarhet beskrivs med var taket går och varför
(t.ex. "fler personer än 4 står i vägen för varandra — skala via ny parallell
station").

## Beslut tagna i grundsessionen (för referens)

Dessa fastslogs när workflow:n sattes upp. Avvik bara om användaren explicit
ber om annat:

- **Skippa `.docx` som default.** Genereras bara på begäran.
- **Inga bilder i denna fas** — läggs till manuellt via appen senare.
- **PDF synkar alltid med `.md`** genom att alltid genereras från `.md`-källan.
  Vi rör aldrig PDF:en för hand.
- **Användaren kan redigera `.md` själv** — håll filerna i ren markdown,
  ingen avancerad syntax.
- **Frontmatter-fält är fasta** — `title`, `category`, `short_description`,
  `slug`, `last_updated`. Lägg inte till nya fält utan att fråga.

## Filer att läsa om något känns oklart

- `docs/info/_templates/*.md` — mallarnas struktur
- `docs/info/utrustning/alp-reparation/alp-reparation.md` — referensexempel
  (ett färdigt utrustningsdokument)
- `src/legacy/services/info.ts` — visar exakt vilka fält `info_articles` har
  i databasen
- `tools/md-to-pdf/build.py` — PDF-generatorn (om något ser konstigt ut i
  PDF:en kan koden behöva justeras)
