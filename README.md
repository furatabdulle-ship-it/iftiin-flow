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

Im Admin-Bereich führt „Shop-Produkte & Inhalte verwalten“ zur Produktverwaltung. Dort lassen sich Entwürfe und veröffentlichte Downloads, Lektionen, Videos sowie Produkte für digitale Downloads, Premium-Artikel und Online-Kurse anlegen. Für aktive Produkte müssen veröffentlichte Inhalte zugeordnet sein. Artikel können im Artikel-Editor als Premium markiert und anschließend als Produktinhalt zugeordnet werden. Bundle und Membership sind im Datenmodell vorgesehen, aber noch nicht zur Veröffentlichung freigegeben.

## Shop, Zahlungen und Lerninhalte

Die Shopseite `/store/` zeigt aktive Produkte und Preise. Angemeldete Käufer werden an Stripe Checkout weitergeleitet; erfolgreiche Webhooks schalten die zum Bestellzeitpunkt gespeicherten Inhalte im Konto frei. Die Kontoseite `/account/` enthält die persönliche Bibliothek, Downloads, Kurslektionen, Lernfortschritt und die letzten Bestellungen. Private Dateien werden erst nach Anmeldung und Zugriffsprüfung über kurzlebige signierte URLs ausgeliefert.

Die Migration `004_commerce_learning.sql` wird zusammen mit den anderen nummerierten Migrationen beim App-Start ausgeführt. Vor dem Aktivieren von Zahlungen zuerst in Stripe einen **Testmodus** einrichten und für `https://<deine-domain>/api/webhooks/stripe/` mindestens diese Events abonnieren:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`
- `charge.refunded`

In Railway beziehungsweise der lokalen `.env` sind folgende Werte erforderlich:

| Variable | Zweck |
|---|---|
| `STRIPE_CHECKOUT_ENABLED` | Checkout nur mit `true` einschalten; Standard `false` |
| `STRIPE_SECRET_KEY` | Stripe-Secret-Key, zuerst `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Signaturgeheimnis des Stripe-Webhook-Endpunkts |
| `STRIPE_LIVE_MODE_ENABLED` | Nur für bewusst freigegebene Livezahlungen auf `true` setzen |
| `STORAGE_ENDPOINT` | HTTPS-Endpunkt des privaten S3-kompatiblen Buckets |
| `STORAGE_BUCKET` | Name des privaten Buckets |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | Zugangsdaten mit Zugriff nur auf den benötigten Bucket |
| `STORAGE_REGION` | Region des Speicheranbieters |

Für Browser-Uploads muss der Bucket CORS `PUT` von der Website-Origin erlauben und den signierten `Content-Type`-Header akzeptieren. Der Bucket darf nicht öffentlich lesbar sein. Uploads sind auf PDF, ZIP und die Videoformate MP4, WebM und MOV mit höchstens 500 MB begrenzt. Ohne Stripe- und Speicher-Konfiguration bleiben Checkout beziehungsweise Upload gesperrt; bestehende Artikel und Konten werden dadurch nicht verändert. Live-Zahlungen erst nach Prüfung von Steuer-, Verbraucher-, Widerrufs- und Datenschutzpflichten aktivieren.

Passwörter müssen mindestens 12 Zeichen lang sein und werden mit scrypt gehasht. Anmeldesitzungen verwenden zufällige, nicht im Klartext gespeicherte Tokens in `HttpOnly`-Cookies. Login-Versuche sind pro Serverprozess begrenzt; bei mehreren App-Instanzen braucht es zusätzlich ein gemeinsames Rate-Limit am vertrauenswürdigen Proxy. In Produktion müssen Website und Datenbankverbindung verschlüsselt übertragen werden.

### Passwort zurücksetzen

Auf der Anmeldeseite führt „Passwort vergessen?“ zum Reset. Dafür müssen in der lokalen `.env` beziehungsweise als Railway-Umgebungsvariablen `RESEND_API_KEY` und `PASSWORD_RESET_FROM` gesetzt sein. `PASSWORD_RESET_FROM` muss eine in Resend verifizierte Absenderadresse enthalten, zum Beispiel `IFTIIN Flow <konto@deine-domain.de>`. `SITE_URL` muss auf die öffentliche Website zeigen, damit der Link in der E-Mail zur richtigen Domain führt. In Docker Compose werden diese Werte an die App weitergegeben.

Reset-Links sind 30 Minuten gültig und nur einmal verwendbar. Nach erfolgreicher Änderung werden alle bestehenden Anmeldesitzungen beendet. Die Datenbankmigration `005_password_reset.sql` wird beim Start beziehungsweise mit `npm run db:migrate` angewendet. Ohne Resend-Konfiguration bleibt der Reset-Endpunkt deaktiviert.

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
