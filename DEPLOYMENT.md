# Deploying on a Linux server with Caddy

The app runs as one persistent Next.js Node process on `127.0.0.1:3066`. Caddy sits in front of it, terminates HTTPS and proxies requests to that port. HTTPS is required: phones only allow camera access, and therefore AR scanning, on secure origins.

This is not a static export. The contribution API (`/api/contributions`) and its SQLite database need the Node server.

The commands assume Ubuntu or Debian and use:

| What | Where |
| --- | --- |
| Application checkout | `/opt/after-augmented-reality` |
| SQLite database | `/var/lib/after-augmented-reality/exhibition.sqlite` |
| Environment file | `/etc/after-augmented-reality.env` |
| Service account | `afterar` |
| Next.js listener | `127.0.0.1:3066` (private) |
| Public domain | `exhibition.example.com` (replace with yours) |

Before you start, point the domain's DNS `A` and/or `AAAA` record at the server and open inbound ports 80 and 443.

## 1. Install Node.js

The contribution database uses the built-in `node:sqlite` module, so the server needs **Node.js 22.13 or newer** (Node 24 LTS is a good choice). Install it from [NodeSource](https://github.com/nodesource/distributions) or your preferred source, then check:

```bash
node --version   # v22.13.0 or newer
command -v npm   # note this path for the systemd unit
```

`npm ci` installs the `canvas` package (used by MindAR's tooling). Prebuilt binaries cover common x64 and arm64 Linux systems. If the install falls back to compiling it, install the build dependencies and run `npm ci` again:

```bash
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev \
  libjpeg-dev libgif-dev librsvg2-dev
```

## 2. Create the service account and directories

```bash
sudo adduser --system --group --home /opt/after-augmented-reality afterar

sudo install -d -o afterar -g afterar \
  /opt/after-augmented-reality \
  /var/lib/after-augmented-reality
```

Clone the repository into `/opt/after-augmented-reality` and hand it to the service account:

```bash
sudo git clone <repository-url> /opt/after-augmented-reality
sudo chown -R afterar:afterar /opt/after-augmented-reality
```

## 3. Add the production environment

Create an environment file that only root and the service account can read:

```bash
sudo install -m 0640 -o root -g afterar /dev/null /etc/after-augmented-reality.env
sudoedit /etc/after-augmented-reality.env
```

Add:

```ini
NODE_ENV=production
EXHIBITION_DATABASE_PATH=/var/lib/after-augmented-reality/exhibition.sqlite
NEXT_PUBLIC_VISUALIZATION_DESIGN=fish
```

`NEXT_PUBLIC_VISUALIZATION_DESIGN` is baked into the client bundle at build time. Set it to `fish`, `creature` or `constellation` before building; changing it later requires a rebuild.

### Exhibition opening time

The shared tank keeps every creature from day to day. To start it at a given moment, so that creatures from earlier tests stay out of it, add the opening time with its time zone offset:

```ini
EXHIBITION_OPENED_AT=2026-10-15T17:00:00+02:00
```

Only creatures released from then on swim in the tank, count towards breaking its walls and appear in the activity map. Earlier ones stay in the database untouched, so removing or changing the line brings them back. When the tank has no seed creatures since the opening, ten are added, timed at the opening. Oslo is at `+02:00` in summer time and `+01:00` from the last Sunday in October. The setting is read at runtime, so restarting the service is enough:

```bash
sudo systemctl restart after-augmented-reality
```

### Test dataset on the server

To try the collective screen with the synthetic exhibition day before opening, add this line to the environment file:

```ini
ENABLE_SYNTHETIC_DATASET=true
```

It is read at runtime, so restarting the service is enough:

```bash
sudo systemctl restart after-augmented-reality
```

The visitor app's exhibition simulator then shows the "Synthetic exhibition day" switch, which adds the test visitors to the database or removes them again. Anyone who can open the site can use it, so switch the dataset off, remove the line and restart the service before the exhibition opens. Real visitor contributions are not affected by the switch.

## 4. Install dependencies and build

```bash
sudo -u afterar sh -c '
  cd /opt/after-augmented-reality
  set -a; . /etc/after-augmented-reality.env; set +a
  npm ci --include=dev
  npm run build
'
```

`--include=dev` matters: with `NODE_ENV=production` set, npm would otherwise skip the devDependencies (Tailwind, PostCSS, TypeScript) that the build needs.

## 5. Run Next.js on port 3066 with systemd

```bash
sudoedit /etc/systemd/system/after-augmented-reality.service
```

```ini
[Unit]
Description=The Fishbowl Leaks
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=afterar
Group=afterar
WorkingDirectory=/opt/after-augmented-reality
EnvironmentFile=/etc/after-augmented-reality.env
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3066

Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
UMask=0027

NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

If `command -v npm` printed something other than `/usr/bin/npm`, use that path in `ExecStart`.

Start it and check that it answers on the loopback interface only:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now after-augmented-reality
curl -I http://127.0.0.1:3066
```

Port 3066 must not be reachable from outside; only Caddy talks to it.

## 6. Install Caddy

Use the [official Caddy package](https://caddyserver.com/docs/install#debian-ubuntu-raspbian):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
  /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

## 7. Proxy the domain to port 3066

```bash
sudoedit /etc/caddy/Caddyfile
```

```caddyfile
exhibition.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3066
}
```

Caddy obtains and renews the TLS certificate itself and redirects HTTP to HTTPS. Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

If UFW is enabled, open HTTP and HTTPS:

```bash
sudo ufw allow 'Caddy Full'
```

Check the public site:

```bash
curl -I https://exhibition.example.com
```

Then open these on a phone and on the exhibition display:

- `https://exhibition.example.com/`: the visitor app (allow camera access when asked)
- `https://exhibition.example.com/collective`: the shared screen, opened full-screen on the display
- `https://exhibition.example.com/particles`: the particle constellation gallery

## Updating to a new version

```bash
sudo -u afterar sh -c '
  cd /opt/after-augmented-reality
  git pull
  set -a; . /etc/after-augmented-reality.env; set +a
  npm ci --include=dev
  npm run build
'
sudo systemctl restart after-augmented-reality
```

The build replaces `.next/` while the old process is still serving from it, so pages can fail briefly until the restart. Update outside opening hours.

If you change particle shapes or target images, run `npm run targets:export`, `npm run targets:compile` and `npm run targets:verify` locally, then commit the new `public/targets/` files before pulling them on the server.

## Data and backups

Submitted visitor stories live in `/var/lib/after-augmented-reality/exhibition.sqlite`, outside the checkout, so updates never touch them. Back up that directory, including any `-wal` and `-shm` files next to the database. For a consistent copy while the app runs, either stop the service briefly or use:

```bash
sudo -u afterar sqlite3 /var/lib/after-augmented-reality/exhibition.sqlite \
  ".backup '/var/lib/after-augmented-reality/backup-$(date +%F).sqlite'"
```

Run only one app instance against this database.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `502 Bad Gateway` from Caddy | The app is not running on 3066: `sudo systemctl status after-augmented-reality` and `sudo journalctl -u after-augmented-reality -n 100` |
| Service exits with `No such built-in module: node:sqlite` | Node is older than 22.13; upgrade Node, then rebuild |
| Build fails with missing `tailwindcss` or `typescript` | `npm ci` ran without `--include=dev` |
| Camera does not start on phones | The page is not served over HTTPS, or camera permission was denied in the browser settings |
| `EADDRINUSE` on port 3066 | Another process holds the port: `sudo ss -ltnp 'sport = :3066'` |
| Certificate not issued | DNS does not point at the server yet, or ports 80/443 are blocked: `sudo journalctl -u caddy -n 100` |

Logs:

```bash
sudo journalctl -u after-augmented-reality -f
sudo journalctl -u caddy --since "10 minutes ago"
```
