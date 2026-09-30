# Plan: deploying to a Raspberry Pi at home, for testing multiplayer

Status: **a plan, not yet adopted.** A first draft of it is on the branch:

- `.github/workflows/pi.yml`
- `deploy/pi/setup.sh`
- `deploy/pi/README.md`
- `CAMPAIGNS_DIR` in `server.js`

Revise it against the decisions below before merging.

## The approach

A GitHub Actions **self-hosted runner** runs on the Pi, and GitHub hands
deploy jobs to it.

- The Pi only ever connects *out* to GitHub. Nothing is opened on the router,
  and GitHub holds no SSH keys or credentials for the Pi.
- The game server runs as a systemd service. It starts on boot and restarts
  if it fails.

## Steps

### 1. The Pi (by hand, once)

- Raspberry Pi OS **64-bit**, on the home network.
- Node.js 20 or later:
  `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git`
- Pick one Linux user to run both the runner and the server (e.g. `pi`).

### 2. The service (a script in the repository, run once with sudo)

- `/opt/pmc-firefight/app`: the code, replaced by every deploy.
- `/var/lib/pmc-firefight/campaigns`: the saved campaigns. A deploy never
  touches this folder.
- A `pmc-firefight` systemd unit:
  - `PORT=8787`, `HOST=0.0.0.0` (reachable from the whole house);
  - `CAMPAIGNS_DIR` pointing at the folder above;
  - `Restart=on-failure`.
- A sudoers line letting that user do two things without a password, and
  nothing else:
  - restart this one service;
  - read its log.
- Installs `rsync` and `curl`.

### 3. The server (a small code change)

- Campaigns are saved in `campaigns/` inside the code folder today, so a deploy
  could wipe them.
- The server takes an optional `CAMPAIGNS_DIR` instead. Unset, nothing changes.

### 4. The runner (by hand, once)

1. On GitHub, open **Settings → Actions → Runners → New self-hosted runner**
   and choose **Linux / ARM64**.
2. Run its download and `config.sh` lines on the Pi, in a folder of their own
   such as `~/actions-runner`. Add `--labels pi` to the `config.sh` line.
3. Install it as a service so it survives reboots:
   `sudo ./svc.sh install pi && sudo ./svc.sh start`
4. It shows as **Idle** on the Runners page once connected.

### 5. The workflow (`.github/workflows/pi.yml`)

- **When**: on a push to `main`, and by hand (**Run workflow** in the Actions
  tab) for any branch, to test one before merging. Never for a pull request.
- **Where**: `runs-on: [self-hosted, pi]`.
- **Steps**:
  1. Check out the code.
  2. `rsync --delete` it into the app folder, leaving out `.git`, `.github`,
     `node_modules`, `/campaigns`, `/build` and `/test`.
  3. Write `deployed.txt` with the branch and commit.
  4. `sudo systemctl restart pmc-firefight`.
  5. Poll `/health` for up to 30 seconds. On failure, print the last 40 lines
     of the service's log.
- **Concurrency**: one deploy at a time; a newer one cancels one still waiting.
- There is no build step: the server serves the source directly, and the
  committed `index.html` already carries its `?v=` stamps.

### 6. Documentation

- `deploy/pi/README.md`: set-up, day-to-day use, and security.
- A pointer to it from `SERVER.md`.

## Testing multiplayer on it

1. Open `http://<pi-name>.local:8787` on two devices. `hostname` on the Pi
   gives the name.
2. On one, press **Multiplayer → Start a game** and read the code out.
3. On the other, join with that code.

To try an unmerged branch, run the workflow on it.
`http://<pi-name>.local:8787/deployed.txt` shows what is live.

The server's log is on the Pi: `journalctl -u pmc-firefight -f`.

## Decisions still to make

1. **Is the repository public or private?** If public, set **Settings → Actions →
   General → Fork pull request workflows → Require approval for all external
   contributors**. Otherwise a stranger's pull request could edit a workflow to
   run on the Pi. A private repository is safe as it is.
2. **When to deploy.** Every push to `main` plus by hand (the plan above), or by
   hand only?
3. **Wait for the tests?** The Pi could deploy only after the `test` workflow's
   unit and art checks pass on `main`, using a `workflow_run` trigger. That is
   slower but never puts a failing build on the Pi.
4. **Access from outside the house** (a phone on mobile data): if wanted, use
   Tailscale on the Pi and the phone, rather than opening a port on the router.
5. **Port and user**: 8787 and `pi` unless something else suits.

## Things to know

- A deploy queued while the Pi is off waits for it. GitHub gives up after a
  day.
- Merging adds the workflow to `main`, and the **Run workflow** button only
  appears from then on. The push that merges it also queues the first deploy,
  which waits until the runner is registered.
- This container has no `rsync`, so the copy step was rehearsed with `tar`.
  The rehearsal confirmed the server starts from the copied folder, answers
  `/health`, and serves `deployed.txt`. It also confirmed that a campaign
  saved through the server lands in `CAMPAIGNS_DIR`, not in the code. The
  workflow, the systemd unit and the sudoers line have not yet run on a real
  Pi.
