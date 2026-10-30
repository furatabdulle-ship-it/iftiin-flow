# iftiin flow.

Astro-Website mit eigenem Node.js-Backend und PostgreSQL. Die öffentlichen Seiten lesen veröffentlichte Beiträge aus der Datenbank. Besucher können Konten erstellen; ein Admin kann Beiträge in einem geschützten Bereich verfassen, bearbeiten und veröffentlichen.

## Lokal starten

Voraussetzungen: Node.js 22.12+ und Docker Desktop.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Öffne anschließend <http://localhost:4321>. Docker startet PostgreSQL, baut die Website, führt die Datenbankmigration aus und startet den Backend-Server. Die lokale Datenbank wird im Docker-Volume `postgres_data` gespeichert.

Für Entwicklung ohne Container:

1. PostgreSQL starten und `DATABASE_URL` in `.env` anpassen.
2. Abhängigkeiten installieren und Datenbankschema anlegen:

   ```powershell
   npm install
   npm run db:migrate
   npm run dev
   ```

## Admin-Konto

Registriere dich über die Website. Befördere danach dein eigenes Konto lokal mit der Datenbank-URL in `.env`:

```powershell
npm run admin:promote -- deine-adresse@example.com
```

Wenn die Datenbank über Docker Compose läuft, führe stattdessen aus:

```powershell
docker compose exec app node scripts/promote-admin.mjs deine-adresse@example.com
```

Danach erscheint im Konto der Zugang zur Artikelverwaltung. Öffentliche Registrierung erstellt immer nur die Rolle `user`; niemand kann sich selbst zum Admin machen. Das Admin-Konto sollte nur eine E-Mail-Adresse sein, auf die du Zugriff hast.

Im Admin-Bereich führt „Shop-Produkte & Inhalte verwalten“ zur kompakten Verwaltung mit den Tabs „Inhalte“ und „Produkte“, Suche und Statusfiltern. Einträge werden in Listen dargestellt; Erstellen und Bearbeiten öffnen jeweils einen eigenen Editor. Dort lassen sich digitale Downloads, Premium-Artikel, Online-Kurse, Bundles und Memberships anlegen. Einmalige Käufe funktionieren für alle Kategorien; Memberships können außerdem monatlich oder jährlich abgerechnet werden. Für aktive Produkte müssen veröffentlichte Inhalte zugeordnet sein. Jedes Produkt kann optional ein JPEG-, PNG- oder WebP-Cover bis 10 MB erhalten; das Bild wird im Shop über einen kurzlebigen signierten Link aus dem privaten Speicher geladen. Artikel können im Artikel-Editor als Premium markiert und anschließend als Produktinhalt zugeordnet werden. Inhalte können nur gelöscht werden, wenn sie keinem Produkt zugeordnet sind und weder für frühere Käufe/Zugänge noch für Lernfortschritte benötigt werden; Produkte und historische Berechtigungen werden dabei nicht automatisch gelöscht.

## Shop, Zahlungen und Lerninhalte

Die Shopseite `/store/` zeigt aktive Produkte aller fünf Kategorien und leitet angemeldete Käufer je nach Abrechnung zu Stripe Checkout für Einmalkäufe oder Membership-Abos weiter. Ein erfolgreicher Checkout-Webhook schaltet die zum Bestellzeitpunkt gespeicherten Inhalte im Konto frei; bei Abos steuern die Stripe-Subscription-Webhooks den laufenden Zugang. Die Kontoseite `/account/` enthält die persönliche Bibliothek, Downloads, Kurslektionen, Lernfortschritt und die letzten Bestellungen. Private Dateien werden erst nach Anmeldung und Zugriffsprüfung über kurzlebige signierte URLs ausgeliefert.

Die Migration `004_commerce_learning.sql` wird zusammen mit den anderen nummerierten Migrationen beim App-Start ausgeführt. Vor dem Aktivieren von Zahlungen zuerst in Stripe einen **Testmodus** einrichten und für `https://<deine-domain>/api/webhooks/stripe/` mindestens diese Events abonnieren:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`
- `charge.refunded`

In Railway beziehungsweise der lokalen `.env` sind folgende Werte erforderlich:

| Variable | Zweck |
|---|---|
| `STRIPE_CHECKOUT_ENABLED` | Checkout nur mit `true` einschalten; Standard `false` |
| `STRIPE_SECRET_KEY` | Stripe-Secret-Key, zuerst `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Signaturgeheimnis des Stripe-Webhook-Endpunkts |
| `STRIPE_LIVE_MODE_ENABLED` | Nur für bewusst freigegebene Livezahlungen auf `true` setzen |
| `STORAGE_ENDPOINT` | HTTPS-Endpunkt des privaten S3-kompatiblen Buckets |
| `STORAGE_BUCKET` | S3-Bucketname |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Zugangsdaten des Buckets |
| `STORAGE_REGION` | S3-Region, bei Railway Buckets `auto` |
| `STORAGE_FORCE_PATH_STYLE` | Optionaler Override: `false` für Railway Buckets, `true` für path-style Endpunkte |

#### Railway Storage Bucket einrichten

Railway Buckets sind private S3-kompatible Buckets. Im Railway-Projekt in der Projektansicht **Create** → **Bucket** wählen, Region festlegen (sie kann nach dem Anlegen nicht geändert werden) und den Bucket erstellen. Laut [Railway-Dokumentation](https://docs.railway.com/storage-buckets/billing) kostet gespeicherter Inhalt **$0.015 pro GB-Monat**; S3-Operationen und Bucket-Egress sind kostenlos. Die Speichernutzung zählt zur Railway-Nutzung und kann enthaltene Tarif-Credits verbrauchen; Nutzung über enthaltene Credits hinaus wird gemäß Tarif abgerechnet. Es wird hier kein Bucket automatisch angelegt.

Im Bucket unter **Credentials** die Werte abrufen. Im Website-Service in Railway die Variablen des Buckets möglichst über **Add Reference** mit diesen Namen verbinden:

| Variable im Website-Service | Railway-Bucket-Variable |
|---|---|
| `STORAGE_ENDPOINT` | `ENDPOINT` |
| `STORAGE_BUCKET` | `BUCKET` |
| `STORAGE_ACCESS_KEY_ID` | `ACCESS_KEY_ID` |
| `STORAGE_SECRET_ACCESS_KEY` | `SECRET_ACCESS_KEY` |
| `STORAGE_REGION` | `REGION` |
| `STORAGE_FORCE_PATH_STYLE` | `false` |

Alternativ kann Railway die Variablen mit dem AWS-SDK-Preset automatisch als `AWS_ENDPOINT_URL`, `AWS_S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` und `AWS_DEFAULT_REGION` bereitstellen. Die Anwendung erkennt sowohl diese Railway-Namen als auch die oben gezeigten `STORAGE_*`-Namen. Neue Railway Buckets verwenden virtual-hosted-style URLs; dafür ist kein manueller Path-Style-Override erforderlich. Maßgeblich für Endpoint, Bucketname, Region und URL-Stil sind die Angaben im Bucket-Tab **Credentials**. Lege den Bucket in derselben Railway-Umgebung wie den Website-Service an, damit Test- und Produktionsdaten getrennt bleiben.

Für Browser-Uploads im Bucket-CORS ausschließlich die Website-Origin `https://www.iftiin-flow.com`, die Methode `PUT` und den Header `Content-Type` erlauben. Den Bucket nicht öffentlich machen. Nach dem Speichern der Variablen den Service neu deployen. Inhalte akzeptieren PDF, ZIP sowie MP4, WebM und MOV bis 500 MB; Produkt-Cover akzeptieren JPEG, PNG und WebP bis 10 MB.

Dateien werden beim Upload direkt mit einer kurzlebigen, auf ein Objekt begrenzten URL übertragen. Downloads laufen zuerst über die Website: Sie prüft Anmeldung, Veröffentlichung und Kaufberechtigung serverseitig und gibt erst danach einen signierten Download-Link frei, der nach 120 Sekunden abläuft. Ohne Speicher-Konfiguration bleiben Datei-Uploads gesperrt; bestehende Artikel und Konten werden dadurch nicht verändert. Live-Zahlungen erst nach Prüfung von Steuer-, Verbraucher-, Widerrufs- und Datenschutzpflichten aktivieren.

Passwörter müssen mindestens 12 Zeichen lang sein und werden mit scrypt gehasht. Anmeldesitzungen verwenden zufällige, nicht im Klartext gespeicherte Tokens in `HttpOnly`-Cookies. Login-Versuche sind pro Serverprozess begrenzt; bei mehreren App-Instanzen braucht es zusätzlich ein gemeinsames Rate-Limit am vertrauenswürdigen Proxy. In Produktion müssen Website und Datenbankverbindung verschlüsselt übertragen werden.

### Passwort zurücksetzen

Der Passwort-Reset versendet E-Mails über die Gmail API mit OAuth und benötigt keinen zusätzlichen E-Mail-Dienst. Railway erlaubt ausgehendes SMTP nur auf Pro und Enterprise; der für dieses Projekt verbundene Railway-Workspace ist Hobby. Die App-Passwörter oder normalen Google-Passwörter werden nicht verwendet.

In der Google Cloud Console ein Projekt erstellen oder auswählen und die Gmail API aktivieren. Den OAuth-Zustimmungsbildschirm konfigurieren; für ein Konto in der eigenen Workspace-Organisation „Intern“ als Zielgruppe verwenden, sofern diese Option verfügbar ist. Einen OAuth-Client vom Typ „Web application“ erstellen und als Weiterleitungs-URI `https://developers.google.com/oauthplayground` hinzufügen. Im [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) in den Einstellungen **Use your own OAuth credentials** aktivieren und Client-ID sowie Secret des eigenen Clients dort lokal eingeben. Im Playground ausschließlich `https://www.googleapis.com/auth/gmail.send` autorisieren, den Consent für das tatsächliche Absenderpostfach erteilen und den Authorization Code gegen Tokens tauschen. Den Refresh Token verwenden, nicht den kurzlebigen Access Token. Ohne eigene OAuth-Zugangsdaten widerruft der Playground Refresh Tokens nach 24 Stunden. Das OAuth-Client-Secret und der Refresh Token sind Geheimnisse und dürfen nur in den Railway-Variablen gespeichert werden.

Für den Versand müssen diese serverseitigen Variablen gesetzt sein:

| Variable | Wert |
|---|---|
| `GMAIL_OAUTH_CLIENT_ID` | OAuth-Client-ID aus der Google Cloud Console |
| `GMAIL_OAUTH_CLIENT_SECRET` | OAuth-Client-Secret; geheim halten |
| `GMAIL_OAUTH_REFRESH_TOKEN` | Refresh Token mit dem `gmail.send`-Scope; geheim halten |
| `GMAIL_SENDER_EMAIL` | Vollständige Adresse des autorisierten Workspace-Postfachs |
| `SITE_URL` | Vertrauenswürdige öffentliche Website-URL, ausschließlich HTTPS und ohne Pfad, Query oder Fragment |

Die OAuth-Freigabe muss für dasselbe Workspace-Postfach wie `GMAIL_SENDER_EMAIL` erteilt worden sein. Das Postfach muss zum Versand über die Gmail API berechtigt sein. Trage die Werte in Railway unter **Project → iftiin-flow service → Variables** im `production`-Environment ein. Lokal gehören sie in `.env`; `.env.example` enthält nur leere Platzhalter. In Docker Compose werden sie an den App-Container weitergereicht. Ohne gültige OAuth-Konfiguration und eine HTTPS-`SITE_URL` bleibt „Passwort vergessen?“ verborgen und der Reset-Endpunkt deaktiviert. HTTP-URLs wie `http://localhost:4321` werden absichtlich nicht für Reset-Links verwendet.

Reset-Links werden kryptografisch zufällig erzeugt, nur gehasht in PostgreSQL gespeichert, sind 30 Minuten gültig und einmal verwendbar. Antworten verraten nicht, ob ein Konto existiert; Anfragen sind zusätzlich begrenzt. Nach erfolgreicher Änderung werden alle bestehenden Anmeldesitzungen beendet. Die Datenbankmigration `005_password_reset.sql` wird beim Start beziehungsweise mit `npm run db:migrate` angewendet.

Die Gmail API sendet als Google Workspace; SPF/DKIM/DMARC und die tatsächliche Zustellbarkeit müssen weiterhin in den empfangenen Nachrichten beziehungsweise mit Googles Admin-/Postmaster-Werkzeugen geprüft werden.

## Artikel

Im Admin-Bereich kannst du Titel, URL-Slug, Teaser, Datum, Themenfeld, Format, Markdown-Inhalt, Tags, Quellen und Veröffentlichungsstatus verwalten. Video-Beiträge unterstützen YouTube- und Vimeo-Links; die Option „Nur für angemeldete Konten anzeigen“ blendet den Beitrag aus öffentlichen Listen aus, leitet nicht angemeldete Besucher zum Login und spielt das Video nach dem Login ab. Der externe Video-Link bleibt beim Anbieter erreichbar, daher ist das kein DRM und kein sicherer Schutz der Videodatei. Entwürfe bleiben privat; nur `published`-Beiträge erscheinen in Explore, Themenfeldern und auf der Startseite. Markdown wird vor der Ausgabe in HTML umgewandelt und bereinigt.

Der bisherige Beispielbeitrag in `src/content/articles/START-HERE.md` ist weiterhin nur ein Entwurf und wird nicht automatisch in die Datenbank importiert. Neue Beiträge werden im Admin-Bereich angelegt.

## Live-Hosting mit Railway

Für den Live-Betrieb kann Railway den Container und PostgreSQL hosten:

1. Das GitHub-Repository in Railway als Projekt verbinden und den App-Service aus dem Repository erstellen. Der vorhandene `Dockerfile` wird automatisch verwendet.
2. Im Projekt einen PostgreSQL-Service hinzufügen.
3. Im App-Service `DATABASE_URL` als Railway-Referenz auf die Verbindungsvariable des PostgreSQL-Service setzen, zum Beispiel `${{Postgres.DATABASE_URL}}` (den tatsächlichen Service-Namen einsetzen).
4. `SITE_URL` zunächst auf die Railway-Domain setzen; nach dem Custom-Domain-Wechsel auf `https://iftiin-flow.com` ändern. `RAILWAY_PUBLIC_DOMAIN` wird von Railway automatisch bereitgestellt.
5. App-Service auf Port `$PORT` lauschen lassen; das Startskript nutzt `HOST=0.0.0.0`. Railway-Healthcheck auf `/api/health/` setzen.
6. Deploy abwarten und den Healthcheck prüfen. Die SQL-Migrationen laufen automatisch vor dem Start.
7. Im Railway-App-Service die eigene Domain hinzufügen und die dort angezeigten DNS-Einträge beim Domainanbieter eintragen. Vor dem Umschalten die aktuellen DNS-Einträge sichern. Erst wenn Railway die Domain und TLS bestätigt, den Custom Domain-Namen als `SITE_URL` setzen.
8. In der Railway-App-Konsole nach erfolgreichem Deploy das erste Admin-Konto hochstufen:

   ```sh
   node scripts/promote-admin.mjs deine-adresse@example.com
   ```

Railway kann je nach Tarif und Nutzung Kosten verursachen; Preise, Limits und PostgreSQL-Backups vor dem Live-Betrieb prüfen. Das PostgreSQL-Datenbankverzeichnis bleibt bei Railway in dessen verwaltetem persistenten Speicher.

## Alternative Hostings

GitHub Pages kann keinen Node.js-Backend-Server ausführen. Der bisherige Pages-Deploy-Workflow wurde durch CI-Prüfungen ersetzt. Für andere Hostings brauchst du:

- einen Host, der den Container oder `node ./dist/server/entry.mjs` dauerhaft ausführen kann;
- eine erreichbare PostgreSQL-Datenbank;
- HTTPS und passende Umgebungsvariablen:

  | Variable | Zweck |
  |---|---|
  | `DATABASE_URL` | PostgreSQL-Verbindungszeichenfolge |
  | `SITE_URL` | öffentliche HTTPS-Adresse der Website |
  | `ADDITIONAL_ALLOWED_ORIGINS` | Optional: zusätzliche erlaubte Web-Ursprünge, kommasepariert (z. B. wenn mehrere Railway-Domains aktiv sind) |
  | `HOST` | Server-Adresse, üblicherweise `0.0.0.0` |
  | `PORT` | Port des Servers, üblicherweise `4321` |
  | `TRUST_PROXY_HEADERS` | Optional `true`, nur wenn ein vertrauenswürdiger Proxy `X-Forwarded-For` vollständig überschreibt |

  Wenn der PostgreSQL-Anbieter TLS verlangt, müssen dessen TLS-Parameter Teil der `DATABASE_URL` sein. Wähle einen Anbieter, der verschlüsselte Verbindungen bereitstellt, und befolge dessen Verbindungsanleitung.

Der Container führt `npm run db:migrate` beim Start aus. Für lokale Entwicklung lassen sich App und PostgreSQL gemeinsam mit Docker Compose starten. Der Compose-Standardzugang ist ausschließlich für lokale Entwicklung gedacht und darf nicht für einen öffentlichen Server verwendet werden.

## Prüfungen

```powershell
npm run check
npm run build
```

## Redaktion und Datenschutz

Vor einem öffentlichen Start müssen Impressum und Datenschutzangaben, Verantwortliche, Hosting-/Datenbankanbieter und die Speicherung von Nutzerkonten geprüft werden. Die Registrierung speichert E-Mail-Adresse, Passwort-Hash und Sitzungsdaten. Derzeit gibt es keine E-Mail-Verifikation oder Löschseite für Nutzerkonten.
