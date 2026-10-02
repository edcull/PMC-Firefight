# The game server on a Raspberry Pi

A Pi runs the game server behind nginx, and GitHub deploys to it:

- every push to `main` deploys `main`, once the tests have passed on it (a
  push whose tests fail is not deployed);
- to try a branch before merging it, open the **pi** workflow in the Actions
  tab, press **Run workflow**, and pick the branch.

Players open `https://<your-domain>/pmc/`. Multiplayer works because the page
came from the server.

The deploy runs *on the Pi*, on a GitHub Actions self-hosted runner. The Pi
only ever reaches out to GitHub: GitHub holds no keys to it, and nothing new
is opened on the router.

## What it needs

- Raspberry Pi OS **64-bit** (Bookworm or later). `uname -m` says `aarch64`.
- Node.js 20 or later (`node -v`). If it is missing or older:

  ```
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs git
  ```

- nginx, with a `location /pmc/` passing to `http://127.0.0.1:8787/`
  (WebSocket upgrade headers included). See [nginx](#nginx) below.

## Setting it up (once)

Do all of this on the Pi, as the user that will run both the server and the
runner (`pi` below; any ordinary user will do, but it must be the same one
for both).

**1. The service.** Fetch the repository once, just for the set-up script:

```
git clone https://github.com/edcull/PMC-Firefight.git ~/pmc-setup
sudo ~/pmc-setup/deploy/pi/setup.sh pi
```

This:

- makes `/opt/pmc-firefight/app` for the code;
- makes `/var/lib/pmc-firefight/campaigns` for the saved campaigns, and keeps
  the database of accounts (`/var/lib/pmc-firefight/pmc.db`) beside them; a
  deploy touches neither;
- installs the build tools the database package falls back on, should it have
  no ready-made build for this Pi;
- installs the `pmc-firefight` service, listening on `127.0.0.1:8787`, so it
  is reached only through nginx;
- lets `pi` restart that one service, and read its log, without a password;
- keeps the server sandboxed: it can write only its data folder,
  `/var/lib/pmc-firefight` (the campaigns, and a database file should it keep
  one), sees the rest of the system read-only and no home folders, and can
  never gain privileges (`NoNewPrivileges`, `ProtectSystem=strict`,
  `ProtectHome`, `PrivateTmp`).

Running `setup.sh` again is safe. It rewrites the service the same way, which
is also how a Pi set up before a change to the script picks the change up:

```
curl -fsSL https://raw.githubusercontent.com/edcull/PMC-Firefight/main/deploy/pi/setup.sh -o /tmp/pmc-setup.sh
sudo bash /tmp/pmc-setup.sh pi
sudo systemctl restart pmc-firefight
```

`~/pmc-setup` can be deleted afterwards.

**2. The runner.** On GitHub, go to the repository's **Settings → Actions →
Runners → New self-hosted runner**, and choose **Linux** / **ARM64**. The page
gives a download command and a `config.sh` line with a one-off token. Run them
on the Pi in a folder of their own, for example `~/actions-runner`, with the
`pi` label added to the `config.sh` line:

```
mkdir ~/actions-runner && cd ~/actions-runner
# the curl … and tar xzf … lines from the GitHub page
./config.sh --url https://github.com/edcull/PMC-Firefight --token <TOKEN> --labels pi --name pmc-pi --unattended
sudo ./svc.sh install pi
sudo ./svc.sh start
```

`svc.sh` keeps the runner going across reboots. The runner shows as **Idle**
on the Runners page once it is connected.

**3. The first deploy.** In the Actions tab, open the **pi** workflow, press
**Run workflow**, and choose `main`. The last step prints
`Up: main @ <commit>`. Then open `https://<your-domain>/pmc/`.

## nginx

Inside the site's `server { … }` block:

```nginx
location = /pmc { return 301 /pmc/; }

location /pmc/ {
    proxy_pass http://127.0.0.1:8787/;      # trailing slash: /pmc/x reaches the game as /x
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;  # the lobby and battles run over a WebSocket
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then `sudo nginx -t && sudo systemctl reload nginx`. The page asks for
everything relative to itself (`health`, `campaigns`, the WebSocket at `ws`),
so any sub-path works. The server pings every 25 seconds, well inside nginx's
60-second idle timeout.

## Day to day

- **Which build is live.** `https://<your-domain>/pmc/deployed.txt` shows the
  branch and commit.
- **The server's log.** `journalctl -u pmc-firefight -f` on the Pi.
- **The runner's log.** `journalctl -u 'actions.runner.*' -f` on the Pi.
- **The Pi is off.** A deploy waits in the queue and runs when the Pi comes
  back. GitHub gives up after a day.

## Accounts

Players sign up for themselves on the Multiplayer screen (a name and a
password, no email), or play a one-off battle as a guest. There is no email to
send a forgotten password to, so it is reset on the Pi:

```
cd /opt/pmc-firefight/app
sudo -u pi DATA_DIR=/var/lib/pmc-firefight node server/admin.js users
sudo -u pi DATA_DIR=/var/lib/pmc-firefight node server/admin.js reset-password "Their Name" "a new password"
sudo -u pi DATA_DIR=/var/lib/pmc-firefight node server/admin.js backup     # a copy beside it, safe while the server runs
```

`create <name> <password> [admin]` and `admin <name> on|off` are there too.

## If it goes wrong

- **The deploy waits forever on "Waiting for a runner".** The runner is not
  connected, or lacks the `pi` label. Check the Runners page, and
  `sudo ./svc.sh status` in `~/actions-runner`.
- **"sudo: a password is required".** The runner runs as a different user from
  the one `setup.sh` was given. Re-run `setup.sh` with the runner's user.
- **"The server did not come up".** The step prints the last lines of the
  service's log. `node -v` must be 20 or later.
- **"Install its packages" fails.** The Pi needs to reach the npm registry,
  and, where the database package has no ready-made build, `build-essential`
  and `python3` (re-run `setup.sh`, which installs them).
- **The page loads but Multiplayer stays greyed out.** nginx is not passing
  `/pmc/health`, or the `Upgrade`/`Connection` lines are missing from the
  `location /pmc/` block.

## Keeping the Pi safe

The workflow deploys only after the tests pass on a push to `main`, or when
started by hand, never for a pull request, so only code already in the
repository runs on the Pi.

If the repository is **public**, also go to **Settings → Actions → General →
Fork pull request workflows** and choose **Require approval for all external
contributors**. Without that, a stranger's pull request could edit a workflow
to run on the Pi.

The game itself has no logins: anyone who finds `/pmc/` can open the lobby and
start games, and read or overwrite the campaigns saved on the server. If that
matters, put nginx basic auth on the `location /pmc/` block.
