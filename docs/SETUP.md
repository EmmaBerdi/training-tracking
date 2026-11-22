# Training — Einrichtung

Persönliche Trainings-App. Läuft als PWA auf dem iPhone, ohne App Store und ohne Apple-Developer-Konto. Die App selbst installiert sich offline, braucht zum Laden und Speichern der Daten aber eine Verbindung zum Backend — siehe zuerst [`docs/BACKEND.md`](BACKEND.md).

Die ganze App — Datenbank, Backend und Frontend — läuft auf einem Raspberry Pi und ist über deine eigene Subdomain per HTTPS erreichbar. Wie du den Pi einrichtest, steht in [`docs/DEPLOY-PI.md`](DEPLOY-PI.md). Danach baut sich der Pi bei jedem neuen Release selbst neu — du musst nichts lokal bauen oder hochladen.

### Ist das Repository öffentlich?

Ja, und das ist unkritisch: Öffentlich ist nur der Programmcode. **Deine Trainingsdaten landen nie im Repo** — sie liegen ausschliesslich in der Postgres-Datenbank auf dem Pi.

Was du beachten solltest: Trägst du persönliche Notizen direkt in den Quellcode ein (etwa Befunde deiner Physio in den Anleitungstexten unter `frontend/src/data/`), stünden die öffentlich. Solche Dinge gehören in die App selbst über "Plan bearbeiten", nicht in den Quelltext.

---

## Auf dem iPhone installieren

1. Deine Adresse (z. B. `https://training.example.com`) **in Safari** öffnen. Chrome und Firefox auf iOS können keine Web-Apps installieren — das geht nur über Safari.
2. Teilen-Symbol antippen (Quadrat mit Pfeil nach oben)
3. Nach unten scrollen → **Zum Home-Bildschirm**
4. Name bestätigen → **Hinzufügen**

Ab jetzt startest du sie über das Icon. Sie öffnet im Vollbild, ohne Safari-Leiste, und funktioniert offline.

Ab jetzt kannst du die App sowohl über das Icon als auch über Safari öffnen — beide zeigen denselben Stand, weil die Daten im Backend liegen und nicht mehr lokal im Browser.

---

## Etwas ändern

Kleine Korrekturen — Übungen, Sätze, Notizen — machst du direkt in der App unter "Plan". Dafür musst du das Repo nicht anfassen.

Am Code selbst änderst du so:

1. Einen Feature-Branch anlegen: `git switch -c feat/name` — direkt auf `main` pushen ist gesperrt
2. Ändern, committen, `git push -u origin feat/name`
3. Auf GitHub einen Pull Request nach `main` öffnen. Die Checks im Reiter **Checks** (Lint, Tests, Build) müssen grün sein, sonst lässt sich nicht mergen
4. **Merge** — damit ist die Änderung auf `main`, aber noch nicht auf dem Pi. Mehrere Merges können so gesammelt in ein Release gehen
5. **Release** — das ist das Deployment. Auf GitHub unter **Releases → Draft a new release** einen neuen Tag auf `main` anlegen (oder `gh release create v1.5.0 --target main --generate-notes`). Spätestens nach 2 Minuten merkt der Pi den neuen Tag, sichert die Datenbank und baut neu (je nach Änderung eine bis einige Minuten). Die laufende Version steht unten im Benutzermenü

Die Versionsnummer folgt `vMAJOR.MINOR.PATCH`:

- **Major** (`v1.4.2` → `v2.0.0`): ein grosses neues Feature
- **Minor** (`v1.4.2` → `v1.5.0`): neue Funktion in einem bestehenden Feature
- **Patch** (`v1.4.2` → `v1.4.3`): Bugfixes und sehr kleine Änderungen

### Neuigkeiten schreiben

Die Release-Notes erscheinen in der App unter "Neuigkeiten" — beim nächsten Öffnen von selbst, und jederzeit über das Benutzermenü. Geschrieben wird für die Leute, die die App benutzen:

- Den Text für die App **oben** in die Release-Notes schreiben. Verstanden werden Überschriften (`## Neu`), Listen (`- …`), Absätze und **fett** (`**…**`); alles andere erscheint als normaler Text
- Was GitHub mit "Generate release notes" anhängt (ab `## What's Changed` bzw. `**Full Changelog**`), blendet die App aus — das darf für dich als Entwicklerliste stehen bleiben
- Steht oben nichts, zeigt die App für dieses Release nichts an. Für reine Bugfix-Releases ist das meist richtig
- Die Notes werden beim Deployment übernommen. Später auf GitHub geändert, erscheinen sie erst mit dem nächsten Release in der App

```markdown
## Neu
- **Neuigkeiten**: Was sich geändert hat, siehst du jetzt direkt in der App

## What's Changed
* feat: what's new from the release notes by @EmmaBerdi in #7
```

Ein manueller Cache-Versionsschritt wie früher entfällt — der Service Worker aktualisiert sich beim nächsten Start der App automatisch, sobald ein neuer Build online ist. Einmal die App schliessen (im App-Umschalter nach oben wischen) und neu öffnen reicht.

---

## Deine Daten sichern

Die App speichert nichts mehr auf dem iPhone selbst — alles liegt in der Postgres-Datenbank hinter deinem Backend. Das Gerät wechseln ist damit kein Problem mehr, ein Ausfall oder versehentliches Löschen der Datenbank aber schon.

Die App selbst hat keinen Export. Gesichert wird deshalb die Datenbank: auf dem Raspberry Pi übernimmt das `deploy/backup.sh` jede Nacht und vor jedem Deployment per `pg_dump` (siehe `docs/DEPLOY-PI.md`), anderswo richtest du ein regelmässiges `pg_dump` selbst ein — es sei denn, ein gehosteter Anbieter macht ohnehin Backups.

Spiel das Zurückspielen eines Dumps einmal durch, solange nichts kaputt ist. Der Moment, in dem du es brauchst, ist der ungünstigste zum Ausprobieren.

---

## Wenn etwas nicht geht

**Änderungen erscheinen nicht**
Auf dem Pi mit `journalctl -u training-deploy -n 50` prüfen, ob der Deploy gelaufen ist und ob der Build fehlgeschlagen ist — dann läuft weiter die alte Version. Sonst: App vollständig geschlossen und neu geöffnet?

**Kein Icon, kein Vollbild**
Die Icons müssen in `frontend/public/` liegen (siehe README-Layout). Prüfen kannst du das, indem du `https://training.example.com/manifest.webmanifest` direkt aufrufst — kommt eine 404, liegt etwas falsch oder der Build ist fehlgeschlagen.

**Daten weg oder Seite zeigt nichts an**
Läuft das Backend auf dem Pi noch? Siehe "When something doesn't work" in `docs/DEPLOY-PI.md`. Als letzter Ausweg hilft das Zurückspielen des letzten `pg_dump`.
