# Training — Einrichtung

Persönliche Trainings-App. Läuft als PWA auf dem iPhone, ohne App Store und ohne Apple-Developer-Konto. Die App selbst installiert sich offline, braucht zum Laden und Speichern der Daten aber eine Verbindung zum Backend — siehe zuerst [`docs/BACKEND.md`](BACKEND.md).

Das Frontend ist eine React/TypeScript-App (siehe [`README.md`](../README.md) für den Aufbau der Ordner) und wird mit einem Build-Schritt aus dem Quellcode erzeugt. Diesen Build übernimmt GitHub Actions automatisch bei jedem Push nach `main` — du musst nichts lokal bauen, nur den Code committen.

---

## Schritt 1 — Repository anlegen

1. Auf github.com oben rechts auf **+** → **New repository**
2. Name: `training` (frei wählbar, taucht später in der URL auf)
3. Sichtbarkeit: **Public**
4. **Add a README file** nicht ankreuzen — du lädst gleich deine eigene hoch
5. **Create repository**

### Warum öffentlich?

GitHub Pages funktioniert im kostenlosen Tarif nur mit öffentlichen Repositories. Für private Repos brauchst du GitHub Pro.

Das ist hier unkritisch: Öffentlich ist nur der Programmcode. **Deine Trainingsdaten landen nie im Repo** — sie liegen ausschliesslich in der Postgres-Datenbank hinter deinem Backend, das du selbst hostest. Wer die URL der App kennt, aber nicht die Adresse deines Backends, sieht nur eine leere Hülle.

Was du beachten solltest: Trägst du später persönliche Notizen direkt in den Quellcode ein (etwa Befunde deiner Physio in den Anleitungstexten unter `src/data/`), stünden die öffentlich. Solche Dinge gehören in die App selbst über "Plan bearbeiten", nicht in den Quelltext.

---

## Schritt 2 — Code hochladen

Am einfachsten mit Git:

```bash
git remote add origin https://github.com/DEINNAME/training.git
git push -u origin main
```

Ohne Git geht es auch über die GitHub-Weboberfläche (**Add file** → **Upload files**, den ganzen Projektordner reinziehen) — dabei **`node_modules/` und `dist/` weglassen**, die werden beim Bau automatisch erzeugt und gehören nicht ins Repo.

---

## Schritt 3 — Pages aktivieren

1. Im Repository auf **Settings** (oben rechts im Repo-Menü, nicht das Konto-Menü)
2. Links in der Seitenleiste auf **Pages**
3. Unter *Build and deployment* → *Source*: **GitHub Actions** (nicht "Deploy from a branch" — der Build läuft über den mitgelieferten Workflow unter `.github/workflows/deploy.yml`)

Nach dem nächsten Push nach `main` baut GitHub Actions die App automatisch (Reiter **Actions** im Repo zeigt den Fortschritt). Ist der Lauf grün, steht oben auf der Pages-Einstellungsseite deine Adresse:

```
https://DEINNAME.github.io/training/
```

Lädt sie noch nicht, warte kurz und aktualisiere. Der erste Aufbau dauert manchmal etwas.

---

## Schritt 4 — Auf dem iPhone installieren

1. Die Adresse **in Safari** öffnen. Chrome und Firefox auf iOS können keine Web-Apps installieren — das geht nur über Safari.
2. Teilen-Symbol antippen (Quadrat mit Pfeil nach oben)
3. Nach unten scrollen → **Zum Home-Bildschirm**
4. Name bestätigen → **Hinzufügen**

Ab jetzt startest du sie über das Icon. Sie öffnet im Vollbild, ohne Safari-Leiste, und funktioniert offline.

Ab jetzt kannst du die App sowohl über das Icon als auch über Safari öffnen — beide zeigen denselben Stand, weil die Daten im Backend liegen und nicht mehr lokal im Browser.

---

## Etwas ändern

Kleine Korrekturen — Übungen, Sätze, Notizen — machst du direkt in der App unter "Plan". Dafür musst du das Repo nicht anfassen.

Am Code selbst änderst du so:

1. Im Repo auf die betroffene Datei (z. B. eine Datei unter `src/components/` oder `src/data/`) → Stift-Symbol oben rechts, oder lokal klonen und in einem Editor öffnen
2. Ändern → **Commit changes** (bzw. `git push`)
3. Im Reiter **Actions** den Build-Lauf abwarten (dauert selten länger als eine Minute)

Ein manueller Cache-Versionsschritt wie früher entfällt — der Service Worker aktualisiert sich beim nächsten Start der App automatisch, sobald ein neuer Build online ist. Einmal die App schliessen (im App-Umschalter nach oben wischen) und neu öffnen reicht.

---

## Deine Daten sichern

Die App speichert nichts mehr auf dem iPhone selbst — alles liegt in der Postgres-Datenbank hinter deinem Backend. Das Gerät wechseln ist damit kein Problem mehr, ein Ausfall oder versehentliches Löschen der Datenbank aber schon.

Die App selbst hat keinen Export. Gesichert wird deshalb die Datenbank: auf dem Raspberry Pi übernimmt das `deploy/backup.sh` jede Nacht per `pg_dump` (siehe `docs/DEPLOY-PI.md`), anderswo richtest du ein regelmässiges `pg_dump` selbst ein — es sei denn, ein gehosteter Anbieter macht ohnehin Backups.

Spiel das Zurückspielen eines Dumps einmal durch, solange nichts kaputt ist. Der Moment, in dem du es brauchst, ist der ungünstigste zum Ausprobieren.

---

## Wenn etwas nicht geht

**Seite bleibt weiss oder zeigt 404**
Prüfe zuerst den Reiter **Actions** — ist der letzte Lauf rot, ist der Build fehlgeschlagen und es wurde nichts deployt. Ist er grün, unter Settings → Pages prüfen, ob *Source* auf **GitHub Actions** steht.

**Kein Icon, kein Vollbild**
Die Icons müssen in `public/` liegen (siehe README-Layout). Prüfen kannst du das, indem du `https://DEINNAME.github.io/training/manifest.webmanifest` direkt aufrufst — kommt eine 404, liegt etwas falsch oder der Build ist fehlgeschlagen.

**Änderungen erscheinen nicht**
Ist der Actions-Lauf für deinen Commit durch und grün? App vollständig geschlossen und neu geöffnet?

**Daten weg oder Seite zeigt nichts an**
Läuft das Backend noch, und ist es unter der in `index.html` gesetzten `API_BASE`-Adresse erreichbar? Das ist inzwischen die häufigste Ursache — nicht mehr ein lokaler Speicher, der abgelaufen ist. Prüfe `docs/BACKEND.md`. Als letzter Ausweg hilft das Zurückspielen des letzten `pg_dump`.
