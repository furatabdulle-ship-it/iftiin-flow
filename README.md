# iftiin flow. — Content-first Website Starter

Schlanke Astro-Website als Grundlage für das Knowledge Magazine mit vorbereiteter Research-, Learning-, Shop- und Buchungs-Erweiterung. **Kein CMS-Login, keine Datenbank, kein Zahlungsanbieter erforderlich.**

## Schnellstart

Voraussetzung: Node.js 20.19+ oder 22.12+ und npm.

```bash
npm install
npm run dev
```

Öffne die angezeigte lokale Adresse (gewöhnlich `http://localhost:4321`).

Produktionsversion:

```bash
npm run build
npm run preview
```

## Was ist öffentlich sichtbar?

- Startseite mit Positionierung und den fünf Themenfeldern
- Explore-Seite (zeigt nur veröffentlichte Artikel)
- Fünf Themenseiten
- About-Seite
- Artikel nur, wenn `status: published`

Andere Seiten erscheinen **nicht** in der Navigation und werden **nicht** generiert. Es gibt keine leeren Shop-/Research-/Learning-Seiten.

## Eigenen Inhalt veröffentlichen

1. Kopiere `src/content/articles/START-HERE.md` nach `src/content/articles/mein-thema.md`.
2. Passe Metadaten (YAML zwischen `---`) und den Markdown-Inhalt an.
3. Belasse `status: draft`, solange der Beitrag nicht online sein soll.
4. Zum Veröffentlichen `status: published` setzen und speichern/committen.
5. Die Website baut beim Deployment automatisch neu. Jede veröffentlichte Datei erscheint in Explore und auf ihrer Themenseite. `featured: true` priorisiert sie auf der Startseite.

Achtung: **Draft-Inhalte liegen trotzdem in einem öffentlichen GitHub-Repository, falls du ein öffentliches Repository verwendest.** Vertrauliche oder noch nicht zur Veröffentlichung bestimmte Texte nicht dort committen! Ein Draft ist nur *nicht auf der Website gerendert*, nicht vor Repository-Lesern geschützt.

Metadatenfelder:

| Feld | Wert |
|---|---|
| `title`, `description` | Überschrift und Teaser |
| `date` | Veröffentlichungsdatum, z. B. `2026-11-15` |
| `updated` | optionales Aktualisierungsdatum |
| `pillar` | einer der fünf Slugs in `src/config.ts` |
| `format` | `essay`, `note`, `map`, `deconstruct`, `research`, `ai-domain`, `capability`, `field-note`, `question` |
| `status` | `draft` oder `published` |
| `featured` | `true` oder `false` |
| `tags` | Liste der Stichworte |
| `sources` | Liste der `{ label, url }` Quellen |

## Später Produkte, Buchungen und Newsletter aktivieren

In `src/config.ts`:

```ts
bookingUrl: 'https://DEINE-VERIFIZIERTE-BUCHUNGSSEITE',
shopUrl: 'https://DEIN-VERIFIZIERTER-SHOP',
newsletterUrl: 'https://DEINE-ANMELDESEITE',
showBooking: true,
showShop: true,
showNewsletter: true,
```

Dadurch erscheinen die entsprechenden Links in Navigation oder Footer. **Es ist noch kein Shop, Checkout, Bezahlvorgang oder Buchungssystem implementiert.** Die Links zeigen zu später angeschlossenen Diensten. Für eigene Produktdetailseiten oder integrierte Buchungen später zusätzliche Seiten und ein geeignetes System ergänzen.

`showResearch`, `showLearning`, `showTools` bleiben `false` bis dafür tatsächlich Seiten implementiert wurden. Einfaches Umschalten ohne Seitenbau würde auf nicht existierende Seiten verlinken.

## GitHub und Veröffentlichung

### Variante A: GitHub → Cloudflare Pages (empfohlen für eigene Domain)

1. Neues Repository bei GitHub erstellen; ZIP-Inhalt hochladen (nicht den übergeordneten Ordner oder das ZIP selbst als alleinige Datei).
2. In Cloudflare Pages **Create project → Connect to Git** wählen und Repository verbinden.
3. Framework preset: **Astro**; Build command: `npm run build`; Output directory: `dist`.
4. Node.js-Version mindestens 22.12 verwenden.
5. Domain `iftiin-flow.com` entsprechend den Hosting-Anweisungen verbinden; bestehende DNS-Einträge vor Änderungen sichern.
6. Optional Umgebungsvariable `SITE_URL=https://iftiin-flow.com` setzen.

### Variante B: GitHub Pages

Eine GitHub-Actions-Workflowdatei ist enthalten. Unter **Settings → Pages → Source: GitHub Actions** auswählen.

- Bei Repo `USERNAME.github.io` ist `BASE_PATH=/` korrekt.
- Bei Projekt-Repo `iftiin-flow` veröffentlicht GitHub Pages unter `USERNAME.github.io/iftiin-flow/`. Der Workflow setzt automatisch den Projekt-Basispfad.
- Für eine eigene Domain mit GitHub Pages muss `SITE_URL` und `BASE_PATH` ggf. angepasst werden; außerdem Domain bei GitHub Pages konfigurieren.

Cloudflare Pages und GitHub Pages **nicht gleichzeitig** für dieselbe Domain aktivieren.

## Redaktion und Rechtliches

- Die Inhalte im Starter sind nur ein **unveröffentlichter Beispieldraft**. Es gibt keine erfundenen veröffentlichten Essays.
- Quellen, Gegenargumente und unabhängige Analyse sind pro Beitrag zu dokumentieren.
- Keine vertraulichen Arbeitgeber-/Kundeninhalte oder fremden Frameworks übernehmen.
- Vor dem echten Launch: Impressum, Datenschutz, Kontakt, Bildrechte, tatsächliche Verantwortliche und Hosting-/Newsletter-DSGVO prüfen. Der Footer enthält einen entsprechenden Platzhalter.
- Bis zur finalen Gestaltung: Schrift über Google Fonts eingebunden; je nach Datenschutzanforderungen lokal hosten, bevor die Site live geht.
- Content-Sprache ist zunächst Deutsch. Mehrsprachigkeit ist ein späterer Ausbau, noch keine implementierte Übersetzungsfunktion.

## Ordnerstruktur

```text
src/config.ts                   Marke, Themen, zukünftige Feature-Schalter
src/content.config.ts           Schema und Validierung für Artikel
src/content/articles/           Artikel in Markdown
src/components/ArticleCard.astro
src/layouts/Base.astro          Navigation, Footer, Metadaten
src/pages/index.astro           Homepage
src/pages/explore.astro         Archiv
src/pages/topics/[slug].astro   Fünf Themenwelten
src/pages/articles/[...slug].astro  Veröffentlichte Beiträge
src/pages/about.astro
src/styles/global.css           Designsystem und Responsive Layout
public/                         statische Assets
```
