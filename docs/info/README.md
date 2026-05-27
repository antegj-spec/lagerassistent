# Info-dokument

Källfiler för info-fliken i Lagerassistent. Varje dokument blir senare
en rad i `info_articles` + en bifogad PDF.

## Mappstruktur

```
docs/info/
├── _templates/
│   ├── utrustning.md
│   ├── maskin.md
│   └── rutin.md
├── utrustning/<slug>/<slug>.md
├── maskiner/<slug>/<slug>.md
└── rutiner/<slug>/<slug>.md
```

Varje dokument bor i en egen mapp så att genererad PDF (och ev. Word) hamnar
bredvid källan: `<slug>.md`, `<slug>.pdf`, `<slug>.docx`.

## Frontmatter — det som synkar till hemsidan

Överst i varje `.md` finns en YAML-block med exakt det info-fliken behöver:

```yaml
---
title: "Pall EPS PRO"
category: "Utrustning"          # Utrustning | Maskiner | Rutiner
short_description: "..."        # Hamnar i info_articles.body — det användaren ser i listan
slug: "pall-eps-pro"
last_updated: "2026-05-27"
---
```

Resten av `.md`-filen (rubriker + brödtext) hamnar bara i PDF:en — det är där den
djupgående infon ligger.

## Workflow

1. Du säger t.ex. "skapa dokument om Pall EPS PRO" eller "lägg till X under Y".
2. Jag frågar kategori om det inte framgår, kopierar rätt mall till
   `docs/info/<kategori>/<slug>/<slug>.md` och fyller i det du sagt.
3. Vi bygger på iterativt — "lägg till om verktyg: ...", "ändra steg 3 till ...".
   Jag placerar det på rätt ställe; om något är otydligt frågar jag.
4. När dokumentet känns klart genererar jag PDF (och Word vid behov).
5. Du laddar upp PDF:en i info-fliken via "Nytt förslag" och kopierar
   `title` + `category` + `short_description` från frontmatter.

## Intake-frågor (kort lista)

Initialt frågar jag bara det jag inte kan gissa:

- **Kategori** — om det inte framgår
- **Titel** — om du bara sagt ett ämne
- **Short description** — kan vi skriva sist också

Övriga fält fyller vi i löpande. Vissa fält kommer vara tomma i ett halvfärdigt
dokument — det är okej, vi reviderar med jämna mellanrum.

## Att redigera själv

`.md`-filerna är ren text. Öppna i valfri editor. Behåll frontmatter-blocket
överst intakt (rubrikerna behövs för att jag ska kunna placera in ny info rätt).
