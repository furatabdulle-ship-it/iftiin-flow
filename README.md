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

Passwörter müssen mindestens 12 Zeichen lang sein und werden mit scrypt gehasht. Anmeldesitzungen verwenden zufällige, nicht im Klartext gespeicherte Tokens in `HttpOnly`-Cookies. Login-Versuche sind pro Serverprozess begrenzt; bei mehreren App-Instanzen braucht es zusätzlich ein gemeinsames Rate-Limit am vertrauenswürdigen Proxy. In Produktion müssen Website und Datenbankverbindung verschlüsselt übertragen werden.

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

Vor einem öffentlichen Start müssen Impressum und Datenschutzangaben, Verantwortliche, Hosting-/Datenbankanbieter und die Speicherung von Nutzerkonten geprüft werden. Die Registrierung speichert E-Mail-Adresse, Passwort-Hash und Sitzungsdaten. Derzeit gibt es keine E-Mail-Verifikation, Passwort-zurücksetzen-Funktion oder Löschseite für Nutzerkonten.
