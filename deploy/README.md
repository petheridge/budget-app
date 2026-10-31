# Host setup

How to run the app on a Debian 12 unprivileged LXC on Proxmox. The container only makes outbound connections: it pulls new versions from GitHub, and nothing needs opening on your router.

Commands marked **Proxmox host** run on the Proxmox host. All others run as root inside the LXC.

## 1. Create the LXC

**Proxmox host.** Create a Debian 12 unprivileged container (1 CPU, 512 MB of RAM and 8 GB of disk are plenty), then turn on the features Docker needs. Replace `<id>` with the container ID:

```sh
pct set <id> --features nesting=1,keyctl=1
pct reboot <id>
```

## 2. Mount the NAS

An unprivileged LXC can't mount NFS itself, so mount it on the Proxmox host and pass it through.

**Proxmox host.** Add the NFS export under Datacenter > Storage, or in `/etc/fstab`. Then, assuming it's mounted at `/mnt/pve/nas`:

```sh
mkdir -p /mnt/pve/nas/budget-backups
pct set <id> -mp0 /mnt/pve/nas,mp=/mnt/nas
pct reboot <id>
```

Root in an unprivileged LXC appears to the host and NAS as UID 100000, so that user needs write access. Either map it on the NAS's NFS export (for example `all_squash` with a suitable `anonuid`), or `chown 100000:100000` the backup folder. Check it from inside the LXC:

```sh
touch /mnt/nas/budget-backups/test && rm /mnt/nas/budget-backups/test
```

## 3. Install Docker

```sh
apt-get update
apt-get install -y ca-certificates curl cron
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
docker run --rm hello-world
```

If containers fail to start with a `permission denied` error mentioning `sysctl`, update the Proxmox host (`apt update && apt full-upgrade`): older LXC packages clash with recent Docker versions.

## 4. Log in to GitHub's container registry

On GitHub, go to Settings > Developer settings > Personal access tokens > Tokens (classic) and create a token with only the `read:packages` scope. Then in the LXC:

```sh
read -rs GHCR_TOKEN   # paste the token and press Enter; nothing is shown or saved to shell history
echo "$GHCR_TOKEN" | docker login ghcr.io -u petheridge --password-stdin
unset GHCR_TOKEN
```

Docker stores the token in `/root/.docker/config.json`. The cron jobs need to run as root to use it.

## 5. Install the app

Copy this `deploy/` folder to `/opt/budget`. From a machine with the repo:

```sh
scp -r deploy root@<lxc-ip>:/opt/budget
```

Then in the LXC:

```sh
cd /opt/budget
chmod +x update.sh backup.sh
cp .env.example .env     # check BACKUP_DEST matches step 2
mkdir -p pb_data
./update.sh
tail logs/update.log
```

The GitHub workflow must have published an image at least once before this works. Migrations apply automatically on startup.

Create your admin account, then add users at `http://<lxc-ip>:8090/_/` in the `users` collection:

```sh
docker compose exec budget /pb/pocketbase superuser create --dir=/pb/pb_data you@example.com 'a-long-password'
```

The app is at `http://<lxc-ip>:8090`.

## 6. Schedule updates and backups

Run `crontab -e` and add:

```cron
*/5 * * * * /opt/budget/update.sh
0 3 * * * /opt/budget/backup.sh
```

Times use the LXC's time zone. Change it with `timedatectl set-timezone Europe/London` if needed.

Run a backup now to check it works, and expect the app to be down for a few seconds:

```sh
/opt/budget/backup.sh
tail /opt/budget/logs/backup.log
ls -lh /mnt/nas/budget-backups
```

Backup failures only appear in `logs/backup.log`, so look at it now and then. `update.sh` and `backup.sh` take turns using a lock, so neither can disturb the other.

## Roll back to an earlier version

Find the commit's full SHA in the repo's Actions or commit history, then pin it in `/opt/budget/.env`:

```sh
IMAGE_TAG=<full-commit-sha>
```

Apply it straight away with `/opt/budget/update.sh`. The pin stays until you change it, so **automatic updates stop**. When a fix has shipped, set `IMAGE_TAG=latest` to resume them.

An older image doesn't undo database changes made by newer migrations. If the version you're leaving changed the schema, restore a backup from before it too.

## Restore a backup

```sh
cd /opt/budget
crontab -l > /root/crontab.bak && crontab -r   # stop scheduled jobs restarting the app
docker compose stop
mv pb_data "pb_data.old-$(date +%F)"
tar -xzf /mnt/nas/budget-backups/pb_data-YYYYMMDD-HHMMSS.tar.gz
docker compose start
crontab /root/crontab.bak
```

Delete the `pb_data.old-*` folder once you're happy with the result.
