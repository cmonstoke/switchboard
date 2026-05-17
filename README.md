# Switchboard

A modern web UI for managed network switches running the **Maxlinear MXL862** firmware — including Sodola, XikeStor, Hasivo, and other OEM variants.

The stock web UI on these switches is painful to use. VLAN configuration is especially bad — large configs time out before you finish saving. Switchboard solves this with CSV import/export: configure your VLANs in a spreadsheet, upload once, done.

---

## Compatible hardware

Any switch running the MXL862 firmware stack, including:

- Sodola SL-8T2XS-WEB
- XikeStor SKS1200-8GPY2XF
- Hasivo S600W-8G-2S-SE
- Other Anhui Xike OEM variants

---

## Running with Docker

### Prerequisites
- Docker + Docker Compose
- A GitHub Personal Access Token with `read:packages` and `repo` scopes

### Setup

```bash
# Log in to GitHub Container Registry
echo YOUR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Create a directory and grab the compose file
mkdir switchboard && cd switchboard
curl -O https://raw.githubusercontent.com/cmonstoke/switchboard/main/docker-compose.yml

# Start
docker compose up -d
```

Open **http://localhost:8880**.

Switch configuration is stored in `./data/switches.json` next to your compose file and survives container restarts and upgrades.

### Updating

```bash
docker compose pull && docker compose up -d
```

### Pinning a version

```yaml
image: ghcr.io/cmonstoke/switchboard:v0.1.0
```

---

## Adding a switch

1. Open the app — the switch list starts empty
2. Click **Add**, enter a name and IP address
3. Select the switch, enter credentials, sign in

The switch list lives in `./data/switches.json`. You can also edit it directly:

```json
[
  {
    "id": "any-unique-string",
    "name": "Core Switch",
    "ip": "192.168.1.10"
  }
]
```

To switch between configured switches, click the switch name at the top of the sidebar.

---

## Features

### Dashboard
- Port status grid — green (up) / red (down) with link speed
- Tx/Rx packet counts per port, auto-formatted (K / M / B)
- Auto-refresh: Off / 1s / 3s / 5s / 10s
- Manual refresh and clear statistics
- Summary: IP, MAC, active port count, firmware version

### VLAN Management

The key feature. Large VLAN configs on these switches time out in the stock UI before you can save. Switchboard lets you configure offline in a spreadsheet and push in one shot.

#### Port VLAN
Per-port PVID, bridge-port enable, tagged/untagged membership.

**Export CSV** → edit in Excel or Google Sheets → **Import CSV** → review → **Apply & Save**

```
Port,Name,BP Enable,PVID,Untagged,Tagged
1,Port 1,1,1,1,0
2,Port 2,1,100,0,1
...
```

#### Tag VLAN (802.1Q)
Full bridge port table (BP_17–BP_80). Per-entry: port, tag type (S/DT), bridge ID (0–63), external VLAN (1–4094), internal VLAN.

Same CSV workflow — export, edit, import, apply.

```
Bridge Port,Enable,Port,Tag Type,Bridge ID,External VLAN,Internal VLAN
BP_17,1,1,S,0,100,0
BP_18,1,2,S,0,200,0
...
```

### System Settings
- Device name
- Network: IP, subnet, gateway, DHCP
- Admin credentials
- Reboot / factory reset

---

## Session management

- Switch sessions are cookie-based (~1 hour inactivity timeout)
- Switchboard sends a keepalive ping every 45 seconds
- Session expiry redirects to login automatically

---

## Development

### Setup

```bash
git clone https://github.com/cmonstoke/switchboard.git
cd switchboard
npm install
npm run dev
```

Open **http://localhost:5173**. Dev mode stores switch configs in `.dev-data/switches.json` (gitignored).

### Feature workflow

```bash
git checkout -b feature/port-settings
# ... work ...
git push -u origin feature/port-settings
# PR → merge to main → Docker image rebuilds automatically
```

### Releasing

```bash
git tag v0.2.0
git push origin v0.2.0
# Publishes :v0.2.0, :v0.2, and :latest
```

### Local Docker build

```bash
docker build -t switchboard .
docker run -d -p 8880:80 -v ./data:/data switchboard
```

---

## Architecture

- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4
- **Proxy**: Node.js middleware routing `/switch/{ip}/*` → `http://{ip}/*` (no hardcoded IPs)
- **Storage**: Switch list in `/data/switches.json` (Docker volume bind mount)
- **Auth**: MD5-hashed credentials over HTTP, matching the switch firmware's own scheme
- **Session**: Cookie-based, keepalive maintained client-side

---

## License

MIT
