# The game server on a Raspberry Pi at home

A Pi on the home network runs the game server, and GitHub deploys to it:

- every push to `main` deploys `main`;
- to try a branch before merging it, open the **pi** workflow in the Actions
  tab, press **Run workflow**, and pick the branch.

Everyone in the house then plays at `http://<pi-name>.local:8787`, and
Multiplayer works because the page came from a server.

The deploy runs *on the Pi*, on a GitHub Actions self-hosted runner, so the Pi
only ever reaches out to GitHub. Nothing needs opening on the router.

## What it needs

- Raspberry Pi OS **64-bit** (Bookworm or later), on the network.
- Node.js 20 or later:

  ```
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs git
  ```

## Setting it up (once)

All of this is done on the Pi, as the user that will run the server (`pi`
below; any user will do).

**1. The service.** Fetch the repository once, just for the set-up script:

```
git clone https://github.com/edcull/PMC-Firefight.git ~/pmc-setup
sudo ~/pmc-setup/deploy/pi/setup.sh pi
```

This does the following:

- makes `/opt/pmc-firefight/app` for the code;
- makes `/var/lib/pmc-firefight/campaigns` for the saved campaigns, which a
  deploy never touches;
- installs the `pmc-firefight` service;
- lets `pi` restart that one service without a password.

**2. The runner.** On GitHub go to the repository's **Settings → Actions →
Runners → New self-hosted runner**, and choose **Linux** / **ARM64**. The page
gives a download command and a `config.sh` line with a one-off token. Run them
on the Pi in a folder of their own, for example `~/actions-runner`. Add the
`pi` label to the `config.sh` line:

```
./config.sh --url https://github.com/edcull/PMC-Firefight --token <TOKEN> --labels pi --name pmc-pi --unattended
sudo ./svc.sh install pi
sudo ./svc.sh start
```

`svc.sh` keeps the runner going across reboots. The runner shows as **Idle**
on the Runners page once it is connected.

**3. The first deploy.** In the Actions tab, run the **pi** workflow on `main`.
The last step prints `Up: main @ <commit>`. Then open
`http://<pi-name>.local:8787` from any device on the network. `hostname` on
the Pi tells you its name.

## Day to day

- **Which build is on the Pi.** `http://<pi-name>.local:8787/deployed.txt` shows
  the branch and commit.
- **The server's log.** `journalctl -u pmc-firefight -f` on the Pi.
- **The Pi is off.** A deploy waits in the queue and runs when the Pi comes
  back.
- **Playing from outside the house** (a phone on mobile data, say). Put the
  Pi and the phone on a private network such as Tailscale rather than opening
  a port on the router.

## Keeping the Pi safe

The workflow runs only on a push to `main` or when you start it by hand,
never for a pull request. Only code that is already in the repository runs on
the Pi.

If the repository is **public**, also go to **Settings → Actions → General →
Fork pull request workflows**. Choose **Require approval for all external
contributors**. Without that, a stranger's pull request could edit a workflow
to run on the Pi. A private repository does not have this problem.
