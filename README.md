# Jettic Cluster Mode

## Backend Roles

Backends now support two roles:

- `child` (default)
- `main`

Set role with environment variables:

- `BACKEND_ROLE=main` for the primary backend
- `BACKEND_ROLE=child` for replica backends (default)
- `MAIN_BACKEND_URL=https://your-main-backend.example.com` on child backends
- `CLUSTER_SYNC_TOKEN=your-shared-secret` on all backends

## Sync Behavior

- Child backends **must complete an initial full sync** from main before serving users.
- Child backends pull from main every 2 minutes.
- Successful child write operations (users, games, config, requests, etc.) are pushed to main.
- Other children receive those changes on their next 2-minute sync pull from main.

## Bootstrap Admin

On first startup, backend ensures a default admin exists:

- Username: `admin`
- Password: `SecurePassword`

## Frontend Multi-Backend Failover

Frontend supports multiple backends and automatic failover.

Configure one of these:

- Query string override: `?api=https://a.example.com,https://b.example.com`
- GitHub secret for Pages build: `FRONTEND_BACKEND_URLS`

The frontend automatically tries the next backend if the current backend is unreachable.

## GitHub-Managed Backend Deploy

The backend deploy workflow is fully driven from GitHub UI.

- Workflow file: [.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)
- It deploys to all backend nodes over SSH.
- It writes runtime env values from GitHub secrets/variables, restarts the backend service, and verifies service status.

### 1) Create SSH key pair for deployments

Run on your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-backend-deploy" -f ~/.ssh/jettic_backend_deploy
```

This creates:

- Private key: `~/.ssh/jettic_backend_deploy`
- Public key: `~/.ssh/jettic_backend_deploy.pub`

### 2) Install public key on every backend server

Option A (recommended):

```bash
ssh-copy-id -i ~/.ssh/jettic_backend_deploy.pub deploy@YOUR_SERVER_IP
```

Option B (manual):

1. SSH into server.
2. Append the contents of `~/.ssh/jettic_backend_deploy.pub` to `~/.ssh/authorized_keys` for your deploy user.
3. Ensure permissions are correct:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 3) Add required GitHub Secrets

Repository Settings -> Secrets and variables -> Actions -> Repository secrets.

Create these secrets:

- `BACKEND_SSH_PRIVATE_KEY`
	- Value: full contents of `~/.ssh/jettic_backend_deploy` (including BEGIN/END lines)
- `CLUSTER_SYNC_TOKEN`
	- Value: any long random string shared by main and child backends
- `JWT_SECRET`
	- Value: long random string
- `UPTIMEROBOT_API_KEY`
	- Value: your UptimeRobot API key (optional but recommended)

### 4) Add required GitHub Variables

Repository Settings -> Secrets and variables -> Actions -> Repository variables.

Create these variables:

- `BACKEND_DEPLOY_REF`
	- Example: `main`
- `BACKEND_NODES_JSON`
	- JSON array describing every backend node.

Example `BACKEND_NODES_JSON`:

```json
[
	{
		"name": "main",
		"host": "1.2.3.4",
		"port": "22",
		"user": "deploy",
		"appDir": "/home/deploy/Jettic",
		"service": "jettic-backend",
		"role": "main",
		"mainBackendUrl": "",
		"publicBaseUrl": "https://main.example.com",
		"portEnv": "3000"
	},
	{
		"name": "child-1",
		"host": "5.6.7.8",
		"port": "22",
		"user": "deploy",
		"appDir": "/home/deploy/Jettic",
		"service": "jettic-backend",
		"role": "child",
		"mainBackendUrl": "https://main.example.com",
		"publicBaseUrl": "https://child1.example.com",
		"portEnv": "3000"
	}
]
```

### 5) Prepare systemd service on each server (one-time)

The workflow updates `/etc/default/<service-name>`, so your service must load it.

Example service file (`/etc/systemd/system/jettic-backend.service`):

```ini
[Unit]
Description=Jettic Backend
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/Jettic/backend
EnvironmentFile=-/etc/default/jettic-backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then run once per server:

```bash
sudo systemctl daemon-reload
sudo systemctl enable jettic-backend
sudo systemctl start jettic-backend
```

### 6) Deploy

Deploy is triggered by:

- push to `main` affecting backend/workflow files
- manual run via Actions -> Deploy Backend Cluster -> Run workflow

### 7) Verify role/sync

For each node:

- `GET /health` should show `role` and child readiness
- `GET /api/cluster/status` should show sync metadata
