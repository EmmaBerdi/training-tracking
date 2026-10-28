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
| `deploy/backup.sh` | Nightly `pg_dump`, keeps the last 14 |

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
git clone https://github.com/YOURNAME/training.git ~/Training_tracking
cd ~/Training_tracking
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

```bash
crontab -e
30 3 * * * /home/pi/Training_tracking/deploy/backup.sh >> /home/pi/backup.log 2>&1
```

Dumps land in `~/training-backups`. Copy them off the Pi periodically — a backup that only exists
on the machine it backs up is not a backup. Restoring:

```bash
gunzip -c ~/training-backups/training-2026-09-09.sql.gz | \
  docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env \
  exec -T postgres psql -U training -d training_tracking
```

---

## Ports

Nothing binds 8080 or 8081. The backend listens on 8080 *inside its own container*, which is a
separate network namespace and does not collide with anything on the Pi; nginx reaches it over the
compose network. The only host port in use is `HOST_PORT` (8090 by default), bound to 127.0.0.1
so it's reachable from the Pi itself only — the tunnel doesn't need it, and on all interfaces it
would serve the app over plain HTTP to the LAN and, through Docker's own firewall rules, to the
Pi's public IPv6 address. Change it in `deploy/.env` if 8090 is taken too.

## Updating

```bash
cd ~/Training_tracking && git pull
docker compose -f deploy/docker-compose.pi.yml --env-file deploy/.env up -d --build
```

The service worker picks up the new frontend the next time you fully close and reopen the app, as
before.

## GitHub Pages

`.github/workflows/deploy.yml` still builds and publishes the frontend on every push to `main`.
That deployment now points nowhere useful — its `window.API_BASE` is unset, so it falls back to
`http://localhost:8080/api`. Either leave it as a harmless dead build or delete the workflow and
turn Pages off in the repository settings.

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

**Changes don't show up after a rebuild**
Close the app fully on the phone and reopen. If it persists, check that Cloudflare isn't serving a
cached `sw.js`: purge the cache in the dashboard, then confirm the no-cache headers with
`curl -I https://training.example.com/sw.js`.
