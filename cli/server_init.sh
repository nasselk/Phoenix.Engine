#!/usr/bin/env bash
#
# server_init.sh — Provision a fresh Ubuntu VPS for the game's deployments.
#
# What the deploy pipeline (scripts/deploy.ts) expects on a target host:
#   • Docker installed and running
#   • The deploy SSH user in the `docker` group so it can run `docker ...`
#     without sudo — deploy.ts runs `docker login/pull/run/...` over SSH
#   • High file-descriptor limits — containers run with
#     `--ulimit nofile=1000000:1000000`
#   • `--network host` containers bind their ports directly (the instance
#     ports in scripts/servers.json), so those must be open
#
# This script is idempotent: safe to re-run. Tested for Ubuntu 24.04 LTS and
# is forward-compatible with 26.04 (falls back to the newest Docker repo
# release if Docker has not yet published one for this Ubuntu codename).
#
# Usage (run on the VPS as root, or with sudo):
#   sudo bash server_init.sh [deploy_user]
#
# `deploy_user` defaults to "ubuntu" (the user in scripts/servers.json).
# Override via arg or the DEPLOY_USER env var, e.g.:
#   sudo DEPLOY_USER=ubuntu bash server_init.sh
#
# Also configurable through the environment:
#   APP_NAME   names the files and firewall rules this script manages
#              (lowercase letters, digits and dashes; default "game")
#   APP_PORTS  the game ports to open, space-separated: every instance port
#              in scripts/servers.json for this host (default "443")
# e.g.:
#   sudo APP_NAME=mygame APP_PORTS="443 8443" bash server_init.sh ubuntu
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEPLOY_USER="${1:-${DEPLOY_USER:-ubuntu}}"
APP_NAME="${APP_NAME:-game}"
APP_PORTS="${APP_PORTS:-443}"
NOFILE_LIMIT=1048576          # >= the 1000000 used by `docker run --ulimit`
SSH_PORT=22
FALLBACK_CODENAME="noble"     # Ubuntu 24.04 LTS — Docker repo always has this

# DDoS backstop on APP_PORTS (the app still enforces the real, fine-grained
# per-IP caps; these are a coarse kernel-level shield against SYN/connection
# floods that would otherwise burn CPU and conntrack before reaching Bun).
# Numbers are deliberately generous: a single NAT/CGNAT egress IP can carry
# many legitimate players, so we only want to catch egregious abuse here.
SYN_RATE_LIMIT=50             # new TCP conns/sec/IP on APP_PORTS before dropping
SYN_RATE_BURST=100            # allowed burst above the sustained rate
CONN_LIMIT_PER_IP=128         # max concurrent conns/IP at the firewall

log()  { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[err]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Please run as root (use: sudo bash $0)"

[[ "$APP_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "APP_NAME must be lowercase letters, digits and dashes, got '$APP_NAME'"

LOWEST_PORT=65535
for port in $APP_PORTS; do
	[[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || die "APP_PORTS must be port numbers, got '$port'"
	if [ "$port" -lt "$LOWEST_PORT" ]; then LOWEST_PORT="$port"; fi
done
[ -n "${APP_PORTS// /}" ] || die "APP_PORTS is empty"
APP_PORTS_CSV="$(echo $APP_PORTS | tr ' ' ',')"

. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || warn "This script targets Ubuntu; detected ID=${ID:-unknown}. Continuing anyway."
log "Provisioning $PRETTY_NAME for deploy user '$DEPLOY_USER'"

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# 1. Full system update
# ---------------------------------------------------------------------------
log "Updating package lists and upgrading all packages"
apt-get update -y
apt-get upgrade -y
apt-get dist-upgrade -y
apt-get autoremove -y --purge
apt-get autoclean -y

log "Installing prerequisites"
apt-get install -y ca-certificates curl gnupg lsb-release ufw apt-transport-https

# ---------------------------------------------------------------------------
# 2. Install the latest Docker CE from Docker's official repository
# ---------------------------------------------------------------------------
log "Configuring Docker's official APT repository"
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
	chmod a+r /etc/apt/keyrings/docker.asc
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"

# Docker may not have published a repo for a brand-new Ubuntu release yet
# (e.g. 26.04 right after launch). Probe it; fall back to the latest LTS,
# whose packages are forward-compatible.
if [ -n "$CODENAME" ] && curl -fsSL -o /dev/null "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/Release"; then
	DOCKER_CODENAME="$CODENAME"
else
	warn "Docker has no repo for Ubuntu '$CODENAME' yet — falling back to '$FALLBACK_CODENAME'."
	DOCKER_CODENAME="$FALLBACK_CODENAME"
fi
log "Using Docker repo for codename: $DOCKER_CODENAME"

echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${DOCKER_CODENAME} stable" \
	> /etc/apt/sources.list.d/docker.list

apt-get update -y
log "Installing latest Docker Engine, CLI, containerd, buildx & compose plugins"
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

log "Enabling and starting the Docker service"
systemctl enable --now docker

# ---------------------------------------------------------------------------
# 3. Docker group membership for the deploy user (deploy.ts runs `docker ...`
#    over fresh SSH sessions, so group access is enough — no sudo required).
# ---------------------------------------------------------------------------
if id "$DEPLOY_USER" >/dev/null 2>&1; then
	log "Adding '$DEPLOY_USER' to the docker group"
	usermod -aG docker "$DEPLOY_USER"

	# Clean up the passwordless-sudo grant left by older versions of this script —
	# docker-group membership replaces it (deploy.ts no longer uses `sudo docker`).
	rm -f "/etc/sudoers.d/90-${DEPLOY_USER}-deploy"
else
	warn "User '$DEPLOY_USER' does not exist — skipping docker-group setup."
	warn "Create it first or pass the correct user: sudo bash $0 <deploy_user>"
fi

# ---------------------------------------------------------------------------
# 4. Kernel tuning — file descriptors, low-latency networking & DDoS hardening
# ---------------------------------------------------------------------------
log "Applying kernel tuning (file descriptors, low-latency net, DDoS hardening)"

# Load (and persist) the modules whose sysctls we set below. Without these the
# bbr / conntrack keys are unknown and `sysctl --system` would error out.
#   tcp_bbr      → BBR congestion control (lower latency under load)
#   nf_conntrack → connection tracking (needed for nf_conntrack_max + fw rules)
cat > "/etc/modules-load.d/${APP_NAME}.conf" <<EOF
tcp_bbr
nf_conntrack
EOF
modprobe tcp_bbr      2>/dev/null || warn "tcp_bbr module unavailable — BBR may not apply."
modprobe nf_conntrack 2>/dev/null || warn "nf_conntrack module unavailable — conntrack tuning may not apply."

# Kernel-wide caps
cat > "/etc/sysctl.d/99-${APP_NAME}.conf" <<EOF
# --- File descriptors (containers use --ulimit nofile=1000000) ---
fs.file-max = 2097152
fs.nr_open = 2097152

# --- Connection backlog: absorb bursts of new game connections ---
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 65535

# --- Let the non-root container user bind its ports without CAP_NET_BIND_SERVICE.
#     The server container runs with --network host, so it shares this netns;
#     lowering the unprivileged-port floor here removes the need for setcap in
#     the image. The lowest game port (not 0) keeps the floor as tight as the app
#     requires; 1024 is the kernel default. ---
net.ipv4.ip_unprivileged_port_start = $(( LOWEST_PORT < 1024 ? LOWEST_PORT : 1024 ))

# --- Low-latency / throughput for live game traffic ---
# BBR + fq: keeps RTT low under load instead of bloating queues.
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
# Faster handshakes and no cold-start after idle gaps (game sockets are
# long-lived but bursty — slow_start_after_idle would re-throttle them).
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_mtu_probing = 1
# Cap unsent data queued in the socket → lower local send latency.
net.ipv4.tcp_notsent_lowat = 16384
# Larger socket buffers for many concurrent connections.
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
# Recycle TIME_WAIT sockets quickly (lots of short reconnects).
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.ip_local_port_range = 1024 65535

# --- SYN-flood / spoofing hardening (DDoS) ---
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_synack_retries = 2
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
# Room for many tracked connections before the table fills (a flood target).
net.netfilter.nf_conntrack_max = 1048576
EOF
# Tolerate individual unknown keys (e.g. a kernel without BBR) instead of
# aborting the whole provisioning run.
sysctl --system >/dev/null || warn "Some sysctl keys could not be applied (see 'sysctl --system')."

# Per-user limits (PAM)
cat > "/etc/security/limits.d/99-${APP_NAME}.conf" <<EOF
*       soft    nofile  ${NOFILE_LIMIT}
*       hard    nofile  ${NOFILE_LIMIT}
root    soft    nofile  ${NOFILE_LIMIT}
root    hard    nofile  ${NOFILE_LIMIT}
EOF

# systemd-managed services (incl. dockerd) honour these, not limits.conf
mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
LimitNOFILE=${NOFILE_LIMIT}
EOF
systemctl daemon-reload
systemctl restart docker

# ---------------------------------------------------------------------------
# 5. Firewall — allow SSH and the game port (host-networked container)
# ---------------------------------------------------------------------------
log "Configuring UFW firewall (allow ${SSH_PORT}/tcp and ${APP_PORTS_CSV}/tcp)"
ufw allow "${SSH_PORT}/tcp"   comment 'SSH'  >/dev/null
for port in $APP_PORTS; do
	ufw allow "${port}/tcp"   comment "${APP_NAME} game server" >/dev/null
done

# Stateful per-IP rate limiting on APP_PORTS — the layer a hosting provider's
# stateless cloud firewall can't provide. Injected as a managed block into UFW's before.rules
# so it lives in the same firewall (no parallel nftables stack to conflict with).
# These rules append to ufw-before-input, i.e. AFTER UFW's RELATED,ESTABLISHED
# accept — so they only ever act on NEW connections and never disturb live
# game sockets. The --network host container exposes its ports on the host stack, so
# the host INPUT chain (and thus these rules) applies to game traffic.
log "Installing per-IP connection rate limiting into UFW before.rules"
BEFORE_RULES=/etc/ufw/before.rules
if [ -f "$BEFORE_RULES" ]; then
	# Drop any previously-installed managed block so re-runs stay idempotent.
	sed -i "/# BEGIN ${APP_NAME}-ddos /,/# END ${APP_NAME}-ddos\$/d" "$BEFORE_RULES"

	# hashlimit names are capped at 15 characters.
	DDOS_BLOCK="$(cat <<EOF
# BEGIN ${APP_NAME}-ddos (managed by server_init.sh — do not edit between markers)
# Drop new connections from a source IP exceeding ${SYN_RATE_LIMIT}/s (burst ${SYN_RATE_BURST}).
-A ufw-before-input -p tcp -m multiport --dports ${APP_PORTS_CSV} --syn -m hashlimit --hashlimit-name ${APP_NAME:0:11}_syn --hashlimit-mode srcip --hashlimit-above ${SYN_RATE_LIMIT}/second --hashlimit-burst ${SYN_RATE_BURST} --hashlimit-htable-expire 30000 -j DROP
# Cap concurrent connections per source IP (coarse; the app enforces the real per-IP cap).
-A ufw-before-input -p tcp -m multiport --dports ${APP_PORTS_CSV} -m connlimit --connlimit-above ${CONN_LIMIT_PER_IP} --connlimit-mask 32 -j DROP
# END ${APP_NAME}-ddos
EOF
	)"

	# Insert the block immediately before the *filter table's COMMIT (first one),
	# i.e. at the end of the ufw-before-input chain. ENVIRON keeps the multi-line
	# value verbatim and avoids awk -v backslash processing.
	export DDOS_BLOCK
	awk '/^COMMIT/ && !done { print ENVIRON["DDOS_BLOCK"]; done=1 } { print }' \
		"$BEFORE_RULES" > "${BEFORE_RULES}.tmp" && mv "${BEFORE_RULES}.tmp" "$BEFORE_RULES"
	unset DDOS_BLOCK
else
	warn "$BEFORE_RULES not found — skipping per-IP rate limiting rules."
fi

ufw --force enable >/dev/null
ufw reload >/dev/null

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------
log "Provisioning complete. Verifying..."
echo "  Docker:   $(docker --version)"
echo "  Compose:  $(docker compose version 2>/dev/null || echo 'n/a')"
echo "  Service:  $(systemctl is-active docker)"
echo "  Deploy user: $DEPLOY_USER"
echo "  App name: $APP_NAME  ports: ${APP_PORTS_CSV}/tcp"
echo "  nofile (root, current shell): $(ulimit -n)"
echo "  Congestion control: $(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo '?') (qdisc: $(sysctl -n net.core.default_qdisc 2>/dev/null || echo '?'))"
echo "  SYN cookies: $(sysctl -n net.ipv4.tcp_syncookies 2>/dev/null || echo '?')  conntrack max: $(sysctl -n net.netfilter.nf_conntrack_max 2>/dev/null || echo '?')"
echo "  Rate limit on ${APP_PORTS_CSV}/tcp: ${SYN_RATE_LIMIT}/s/IP (burst ${SYN_RATE_BURST}), ${CONN_LIMIT_PER_IP} concurrent/IP"
echo
log "Done. The host is ready for 'bun run deploy'."
echo "Note: existing SSH sessions keep their old ulimits — reconnect (or reboot)"
echo "      so new limits and the docker group membership take full effect."
