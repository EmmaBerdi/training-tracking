# Deploying to a Raspberry Pi

Runs the whole app — Postgres, the backend, and the frontend — on a Pi at home, published to the
internet over HTTPS through a Cloudflare tunnel. No port forwarding, no static IP, no certificate
to renew, and nothing new listening on the Pi's own ports.

The pieces, all in `deploy/`:

| Path | Purpose |
|---|---|
| `deploy/docker-compose.pi.yml` | The four services: Postgres, backend, nginx, tunnel |
| `deploy/nginx.pi.conf` | Serves the built frontend, proxies `/api` to the backend |
| `deploy/.env.example` | Template for the secrets and hostname; copy to `deploy/.env` |
| `deploy/backup.sh` | `pg_dump` (nightly and before every deploy), checked by a test restore, keeps the last 14 |
| `deploy/restore-check.sh` | Restores a dump into a throwaway Postgres and counts its rows |
| `deploy/mac/` | Script and launchd job that copy the dumps to your Mac daily |
| `deploy/auto-deploy.sh` | Checks out the newest release tag and rebuilds when there is a new one |
| `deploy/training-deploy.service`, `.timer` | systemd units that run `auto-deploy.sh` every 2 minutes |

Everything is on one origin, so there is no CORS to configure and no mixed content to worry about:
the browser loads `https://training.example.com` and calls `https://training.example.com/api/...`.

---

## Do you need to buy a domain?

Not if you already own one in Cloudflare. A named tunnel needs a hostname in a zone on your
account, but a subdomain of a domain you already have — `training.example.com` — costs nothing and
takes one DNS record, which the tunnel creates for you.

---

## Step 1 — Prepare the Pi

Raspberry Pi OS **64-bit** (Bookworm or later). Check:

```bash
uname -m       # must print aarch64 — the 32-bit OS can't run these images
free -h
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"      # log out and back in for this to take effect
```

Two things worth doing before you put real data on it:

- **Boot from a USB SSD, not the SD card.** Postgres writes constantly and SD cards wear out under
  that; a dying card usually takes the database with it silently.
- **Check swap** if the Pi has 2 GB of RAM or less. The Maven build in step 4 is the heaviest thing
  that will ever run here and can run out of memory. `sudo dphys-swapfile swapoff`, raise
  `CONF_SWAPSIZE` to `2048` in `/etc/dphys-swapfile`, then `sudo dphys-swapfile setup && sudo
  dphys-swapfile swapon`.

## Step 2 — Get the code onto the Pi

```bash
git clone https://github.com/YOURNAME/training.git ~/training-tracking
cd ~/training-tracking
```

## Step 3 — Create the tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**.
Name it (`training`), and on the install screen **copy the token** out of the `docker run` command
it shows — you want the token, not the command; `docker-compose.pi.yml` already runs cloudflared
for you.

Then add a public hostname on the tunnel:

| Field | Value |
|---|---|
| Subdomain | `training` |
| Domain | your domain |
| Service type | `HTTP` |
| URL | `frontend:80` |

`frontend:80` is the service name on the compose network — cloudflared runs beside it in the same
stack, so that resolves. Cloudflare creates the DNS record itself.

The backend already throttles login, invitations and password reset per client IP (see
[`BACKEND.md`](BACKEND.md#rate-limits)); it reads that IP from the `CF-Connecting-IP` header
Cloudflare sets. Optionally, a rate-limiting rule in the Cloudflare dashboard (**Security → WAF →
Rate limiting rules**, matching URI path starting with `/api/auth/`) stops a flood at the edge,
before it ever reaches the Pi.

## Step 4 — Configure and start

```bash
cp deploy/.env.example deploy/.env
openssl rand -base64 48        # JWT_SECRET
openssl rand -base64 24        # DB_PASSWORD
nano deploy/.env               # fill in APP_HOSTNAME, TUNNEL_TOKEN, JWT_SECRET, DB_PASSWORD
```

`JWT_SECRET` is the one that matters most. The default in `application.yml` is a published
dev-only string; leaving it in place on a host reachable from the internet would let anyone forge
a token for any account.

`MAIL_*` is optional: it is the SMTP account that sends password reset codes. Without it the app
runs normally, but "Passwort vergessen?" never delivers a code. See [Outgoing mail](#outgoing-mail)
for setting it up.

```bash
docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env up -d --build
```

The first build compiles the backend with Maven and the frontend with Vite on the Pi itself —
expect roughly 10–20 minutes on a Pi 4, a few minutes on a Pi 5. Later rebuilds are much faster.
Liquibase applies the schema on the backend's first start.

```bash
docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env ps
docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env logs -f backend
```

`restart: unless-stopped` means the stack comes back on its own after a power cut or reboot.

## Step 5 — Check it

- On the Pi itself: `curl -I http://127.0.0.1:8090`
- From anywhere: `https://training.example.com`

Then install it on the iPhone from the new address exactly as `docs/SETUP.md` describes — open it
**in Safari**, share sheet, *Zum Home-Bildschirm*. If the old GitHub Pages version is already on
your home screen, delete that icon first; it is a separate origin with its own service worker and
stored tokens, and it will keep pointing at whatever `window.API_BASE` said.

## Step 6 — Backups

The Pi dumps the database every night and before every deploy; your Mac copies the dumps off the
Pi once a day. A backup that only exists on the machine it backs up dies with its SD card.

### On the Pi

```bash
crontab -e
30 3 * * * /home/berdi-websites/training-tracking/deploy/backup.sh >> /home/berdi-websites/backup.log 2>&1
```

Dumps land in `~/training-backups`, the last 14 are kept. Before a dump is kept,
`deploy/restore-check.sh` restores it into a throwaway Postgres container and counts users,
exercises and images; `backup.log` shows the counts. A dump that doesn't restore is thrown away
and the run fails, leaving the older dumps untouched. Before a deploy that also stops the deploy:
`auto-deploy.sh` retries on its next run, and nothing goes live without a backup that restores.

### Copies on the Mac

The Mac fetches the dumps over SSH with a key that can only *read* `~/training-backups`: it can't
open a shell on the Pi or change or delete anything there, so whoever gets into the Pi can't reach
the copies either way. The copies sit in `~/training-backups` on the Mac, encrypted by FileVault,
for 30 days.

The job only reaches the Pi on the home network. Away from home it fails quietly, and the first
run back home fetches every dump it missed — the Pi keeps 14 days of them. If no copy succeeds for
3 days, a "Training backup" notification says so.

1. On the Mac, a key just for this. No passphrase, since launchd has nobody to type it; step 2 is
   what keeps it harmless:

   ```bash
   ssh-keygen -t ed25519 -N '' -C training-backup -f ~/.ssh/training-backup
   cat ~/.ssh/training-backup.pub
   ```

2. On the Pi, append one line to `~/.ssh/authorized_keys`, with the public key from step 1.
   `restrict` takes away the shell and forwarding, `rrsync -ro` allows reading this one directory
   only. `rrsync` comes with the `rsync` package (`sudo apt install rsync` if it's missing).

   ```text
   restrict,command="rrsync -ro /home/berdi-websites/training-backups" ssh-ed25519 AAAA… training-backup
   ```

3. On the Mac, in `~/.ssh/config`, with the Pi's name or address on your home network:

   ```text
   Host training-pi
     HostName raspberrypi.local
     User berdi-websites
     IdentityFile ~/.ssh/training-backup
     IdentitiesOnly yes
   ```

   Connect once by hand to accept the Pi's host key — the job runs in batch mode and won't ask.
   The answer `rrsync error: SSH_ORIGINAL_COMMAND does not run rsync` is correct: it shows the
   key gets no shell.

   ```bash
   ssh training-pi
   ```

4. Install the launchd job. It runs `deploy/mac/pull-backups.sh` from the repo checkout at
   `~/IdeaProjects/Training_tracking`; edit the path in the plist first if yours is elsewhere, and
   keep that checkout on `main`.

   ```bash
   sed "s|/Users/YOU|$HOME|g" deploy/mac/local.training-tracking.pull-backups.plist \
     > ~/Library/LaunchAgents/local.training-tracking.pull-backups.plist
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.training-tracking.pull-backups.plist
   ```

   It runs at once, then daily at 12:00 and at every login; a run missed while the Mac sleeps
   happens on wake. Check the first one:

   ```bash
   tail ~/Library/Logs/training-backup.log      # "pulled from training-pi"
   ls -l ~/training-backups
   ```

   Run it by hand: `launchctl kickstart gui/$(id -u)/local.training-tracking.pull-backups`.

### Restoring from a backup

1. Pick the dump on the Mac: the newest one in `~/training-backups` from before the problem.
2. Copy it to the Pi with your normal login — not `training-pi`, whose key can only read:

   ```bash
   scp ~/training-backups/training-2026-09-09-0330.sql.gz berdi-websites@raspberrypi.local:
   ```

3. On the Pi, check it restores, without touching the live database:

   ```bash
   cd ~/training-tracking
   deploy/restore-check.sh ~/training-2026-09-09-0330.sql.gz
   ```

4. Replace the live database. A plain dump can't be loaded over existing tables, so the database
   is dropped and recreated first: **everything since the dump is lost**. If the database still
   runs, `deploy/backup.sh` first keeps its current state as one more dump.

   ```bash
   COMPOSE="docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env"
   $COMPOSE stop backend
   $COMPOSE exec -T postgres dropdb -U training training_tracking
   $COMPOSE exec -T postgres createdb -U training training_tracking
   gunzip -c ~/training-2026-09-09-0330.sql.gz | \
     $COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 --single-transaction -U training -d training_tracking
   $COMPOSE start backend
   ```

   If the dump is from an older release, Liquibase applies the newer changesets as the backend
   starts.

---

## Ports

Nothing binds 8080 or 8081. The backend listens on 8080 *inside its own container*, which is a
separate network namespace and does not collide with anything on the Pi; nginx reaches it over the
compose network. The only host port in use is `HOST_PORT` (8090 by default), bound to 127.0.0.1
so it's reachable from the Pi itself only — the tunnel doesn't need it, and on all interfaces it
would serve the app over plain HTTP to the LAN and, through Docker's own firewall rules, to the
Pi's public IPv6 address. Change it in `deploy/.env` if 8090 is taken too.

## Step 7 — Automatic deploys

Every published release goes live on its own; merges to `main` alone don't. Work happens on
feature branches; a pull request into `main` has to pass `.github/workflows/ci.yml` (lint, unit
tests, build, backend tests) before it can be merged. That gate only holds with branch protection
on `main`: in the repository, **Settings → Branches → Add branch ruleset**, target `main`, and
enable *Require a pull request before merging*, *Require status checks to pass* (add `frontend`
and `backend`) and *Block force pushes*.

Shipping is a GitHub release with a semantic version tag on `main`:

| Bump | When | Example |
|---|---|---|
| Major | A big new feature | `v1.4.2` → `v2.0.0` |
| Minor | New functionality in an existing feature | `v1.4.2` → `v1.5.0` |
| Patch | Bug fixes and very small changes | `v1.4.2` → `v1.4.3` |

```bash
gh release create v1.5.0 --target main --generate-notes   # or Releases → Draft a new release
```

On the Pi, a systemd timer runs `deploy/auto-deploy.sh` every 2 minutes. It does one `git fetch`;
only when the newest `vX.Y.Z` tag differs from the one in `deploy/.deployed-version` does it back
up the database, check out the tag and rebuild, passing the version into the frontend build (shown
at the bottom of the user menu). Before the build it also saves the GitHub release notes (public
API, no token) as `frontend/public/whats-new.json`, which the app shows as "Neuigkeiten"; if
GitHub is unreachable the deploy goes ahead without them. Pre-release tags like `v2.0.0-rc1` are
ignored. The units assume
user `berdi-websites` and the repo at `/home/berdi-websites/training-tracking` — edit
`deploy/training-deploy.service` first if yours differ.

```bash
cd ~/training-tracking
git status                               # must be a clean working tree
sudo cp deploy/training-deploy.service deploy/training-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now training-deploy.timer
```

Watch it:

```bash
systemctl list-timers training-deploy.timer   # next and last run
journalctl -u training-deploy -f              # deploy output, incl. build errors
sudo systemctl start training-deploy           # check now instead of waiting
```

If a build fails, the old containers keep running and the tag is already recorded as deployed, so
the timer won't retry it — fix forward with a patch release, or rerun the `up -d --build` below by
hand. The script refuses to deploy at all if someone edited files on the Pi; `git status` there
shows what.

To roll back, publish the fix as a new patch release; the timer only ever moves to the newest tag.

The service worker picks up the new frontend the next time you fully close and reopen the app.

### Updating by hand

```bash
cd ~/training-tracking && git fetch --tags && git checkout v1.5.0
APP_VERSION=1.5.0 docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env up -d --build
```

## Outgoing mail

Reset codes go out through Proton Mail's SMTP submission, from `noreply@berdi-racing.com`. Proton
SMTP needs a paid plan and an address on a custom domain; `@proton.me` addresses can't send this
way.

`berdi-racing.com` is shared with another app that also sends through Proton, so the domain's DNS
records already exist in Cloudflare. They are domain-wide — changing any of them affects both
apps:

| Type | Name | Value |
|---|---|---|
| TXT | `@` | `protonmail-verification=…` |
| MX | `@` | `mail.protonmail.ch` (10), `mailsec.protonmail.ch` (20) |
| TXT | `@` | `v=spf1 include:_spf.protonmail.ch ~all` |
| CNAME | `protonmail._domainkey`, `protonmail2._domainkey`, `protonmail3._domainkey` | the `…domains.proton.ch` targets Proton shows, **DNS only** (not proxied) |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:nick@berdi-racing.com` |

A domain may have only one SPF record; another sender gets an extra `include:` in it, not a second
record.

### Setting it up

1. In Proton, **Settings → Addresses**: create `noreply@berdi-racing.com`.
2. **Settings → Proton Mail → IMAP/SMTP → SMTP tokens → Generate token**, for that address. Give
   this app its own token rather than reusing the other app's, so either can be revoked alone.
   Proton shows the token once.
3. On the Pi, check outbound port 587 is open — certificate lines or a `250` mean it is:

   ```bash
   openssl s_client -starttls smtp -connect smtp.protonmail.ch:587 -crlf -quiet </dev/null
   ```

4. In `deploy/.env`, exactly these names — the backend ignores `SMTP_HOST`, `MAIL_USER` and the
   like without complaint:

   ```env
   MAIL_HOST=smtp.protonmail.ch
   MAIL_PORT=587
   MAIL_USERNAME=noreply@berdi-racing.com
   MAIL_PASSWORD=<the SMTP token>
   MAIL_FROM=noreply@berdi-racing.com
   MAIL_FROM_NAME=NOREPLY Berdi racing
   MAIL_CONTACT=<the address users can write to with questions>
   ```

   `MAIL_FROM` must be the address the token belongs to, or Proton rejects the mail.
   `MAIL_FROM_NAME` is the name the inbox shows instead of the bare address. `MAIL_CONTACT` is
   named in each mail's footer, since replies to `noreply@` go unread.
   `PASSWORD_RESET_LOG_CODE` stays unset in production. Then `chmod 600 deploy/.env`.
5. Recreate the backend and confirm the values reached the container:

   ```bash
   docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env up -d backend
   docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env exec backend env | grep -E 'MAIL_(HOST|PORT|USERNAME|FROM)'
   ```

6. Request a reset for a real account and check the mail's source (GMX: *Quelltext anzeigen*,
   Gmail: *Show original*): `Authentication-Results` should show `spf=pass`, `dkim=pass` and
   `dmarc=pass`. GMX filed the earlier plain-text reset mail as spam; the HTML mail with a plain-text
   alternative and a sender name is meant to fix that, so check GMX, Gmail and iCloud after a change.

## When something doesn't work

**`training.example.com` gives a Cloudflare error 1033 or 530**
The tunnel isn't connected. `docker compose ... logs tunnel` — usually a wrong or rotated
`TUNNEL_TOKEN`.

**502 from Cloudflare**
The tunnel is up but can't reach the service. Check the public hostname's URL is exactly
`frontend:80`, and that the frontend container is running.

**The app loads but every API call fails**
`docker compose ... logs backend`. If it's restarting, the usual causes are a `DB_PASSWORD`
mismatch against an existing volume, or Liquibase refusing to start over a changed changeset.

**Uploading an exercise photo fails around 1 MB**
`client_max_body_size` in `deploy/nginx.pi.conf` isn't being applied — confirm the file is mounted
(`docker compose ... exec frontend cat /etc/nginx/conf.d/default.conf`).

**No reset mail arrives**
The reset endpoint answers the same whether or not the mail went out, so look in the backend log.
`No mail host configured` means `MAIL_HOST` didn't reach the container — run the `env | grep`
check from [Outgoing mail](#outgoing-mail). `Could not send mail` comes with the
SMTP error: `AuthenticationFailedException` is a wrong `MAIL_USERNAME` or token, a sender error is
a `MAIL_FROM` that doesn't match the token's address. Also check the spam folder.

**`backup.log` shows `restore check: … does not restore`, or a deploy stops at the backup**
The new dump was thrown away; the older ones are untouched. The lines above it say why — usually
`Service "postgres" is not running`, then `docker compose ... ps` and `logs postgres`.

**No new dumps arrive on the Mac**
`tail ~/Library/Logs/training-backup.log` on the Mac. Away from home that's expected. `Host key
verification failed` means `ssh training-pi` was never run by hand, or the Pi was reinstalled;
`Permission denied (publickey)` a missing or mistyped line in the Pi's `authorized_keys`;
`rrsync error` a wrong directory in that line.

**Changes don't show up after a rebuild**
Close the app fully on the phone and reopen. If it persists, check that Cloudflare isn't serving a
cached `sw.js`: purge the cache in the dashboard, then confirm the no-cache headers with
`curl -I https://training.example.com/sw.js`.
