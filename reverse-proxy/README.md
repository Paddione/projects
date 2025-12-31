# Nginx Proxy Manager

This directory contains the configuration for Nginx Proxy Manager, which provides reverse proxy functionality for all services.

## Server Information

- **Server IP**: 10.0.0.46/8
- **Remote Directory**: `/home/patrick/nginxproxymanager` (on 10.0.0.46)
- **Local Directory**: `/home/patrick/projects/reverse-proxy` (via SSH tunnel)
- **Admin Interface (Remote)**: http://10.0.0.46:81
- **Admin Interface (Tunnel)**: http://localhost:8081
- **HTTP Port**: 80 (remote) / 8080 (tunnel)
- **HTTPS Port**: 443 (remote) / 8443 (tunnel)

## SSH Tunnel Access (Recommended for Remote Management)

### Establish SSH Tunnel

For remote access from your local machine, use an SSH tunnel to securely forward the proxy manager ports:

```bash
# From WSL/Linux
ssh -i /mnt/c/Users/PatrickKorczewski/.ssh/id_ed25519 \
    -L 8081:localhost:81 \
    -L 8080:localhost:80 \
    -L 8443:localhost:443 \
    -N -f patrick@10.0.0.46

# From Windows PowerShell
ssh -i C:\Users\PatrickKorczewski\.ssh\id_ed25519 ^
    -L 8081:localhost:81 ^
    -L 8080:localhost:80 ^
    -L 8443:localhost:443 ^
    -N -f patrick@10.0.0.46
```

**Flags explained:**
- `-L 8081:localhost:81` - Forward local port 8081 to remote port 81 (admin UI)
- `-L 8080:localhost:80` - Forward local port 8080 to remote port 80 (HTTP)
- `-L 8443:localhost:443` - Forward local port 8443 to remote port 443 (HTTPS)
- `-N` - Don't execute remote command (just forward ports)
- `-f` - Run in background

### Check Tunnel Status

```bash
# Check if tunnel is running
ps aux | grep "ssh.*10.0.0.46" | grep -v grep

# Check forwarded ports
netstat -tlnp | grep -E ":(8081|8080|8443)"
# or
ss -tlnp | grep -E ":(8081|8080|8443)"

# Test connection
curl http://localhost:8081
```

### Kill Existing Tunnel

```bash
# Find the SSH tunnel process
ps aux | grep "ssh.*10.0.0.46" | grep -v grep

# Kill by PID
kill <PID>

# Or kill all SSH tunnels to this server
pkill -f "ssh.*10.0.0.46"
```

### Access via SSH Tunnel

Once the tunnel is established, access the admin interface locally:

- **Admin UI**: http://localhost:8081
- **HTTP Services**: http://localhost:8080
- **HTTPS Services**: https://localhost:8443

**Note**: DNS won't work through the tunnel for domain-based proxies. Use direct IP access on the remote network for domain-based services.

## Quick Start (On Remote Server)

```bash
# SSH into the server
ssh patrick@10.0.0.46

# Navigate to the proxy directory
cd /home/patrick/nginxproxymanager

# Start the proxy manager
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the proxy manager
docker-compose down
```

## Initial Setup

1. **Establish SSH Tunnel** (if accessing remotely):
   ```bash
   ssh -i /mnt/c/Users/PatrickKorczewski/.ssh/id_ed25519 \
       -L 8081:localhost:81 \
       -L 8080:localhost:80 \
       -L 8443:localhost:443 \
       -N -f patrick@10.0.0.46
   ```

2. **Start Nginx Proxy Manager** (on remote server):
   ```bash
   # SSH into server
   ssh patrick@10.0.0.46
   cd /home/patrick/nginxproxymanager
   docker-compose up -d
   ```

3. **Access the admin interface**:
   - Via SSH Tunnel: http://localhost:8081 (recommended for remote access)
   - Direct on Network: http://10.0.0.46:81

4. **Default login credentials**:
   - Email: `admin@example.com`
   - Password: `changeme`

   **IMPORTANT**: Change these immediately after first login!

5. **Add proxy hosts for your services**:
   - auth.korczewski.de → http://10.10.0.3:5500 (or host.docker.internal:5500)
   - l2p.korczewski.de → http://10.10.0.3:5173
   - etc.

## Network Configuration

The proxy manager creates a Docker network `proxy-network` (10.10.0.0/24).

To connect other services to this network, add to their docker-compose.yml:

```yaml
networks:
  default:
    name: proxy-network
    external: true
```

Or use `host.docker.internal` to access services running on the host machine (like your auth service running with tsx).

## Accessing from Different Clients

### From Same Network (10.0.0.0/8)
Any device on the network can access:
- **Admin UI**: http://10.0.0.46:81
- **HTTP Services**: http://10.0.0.46 (port 80)
- **HTTPS Services**: https://10.0.0.46 (port 443)

### From Internet (via Domain)
Services are accessible via their configured domains:
- https://auth.korczewski.de
- https://l2p.korczewski.de
- https://chat.korczewski.de
- etc.

### SSH/SFTP Access for File Editing
Connect using:
```bash
ssh patrick@10.0.0.46
# or
sftp patrick@10.0.0.46
```

Then navigate to: `/home/patrick/projects/reverse-proxy`

### Supported Clients
- **Web Browser**: Access admin UI at http://10.0.0.46:81
- **VS Code Remote SSH**: Install "Remote - SSH" extension
- **FileZilla/WinSCP**: SFTP connection to 10.0.0.46
- **Terminal**: SSH directly to server

## Proxy Host Configurations

The proxy host configurations are stored in `./nginx/proxy_host/` and are automatically loaded by Nginx Proxy Manager.

Existing configurations:
- 1.conf: chat.korczewski.de
- 2.conf: forge.korczewski.de
- 3.conf: api.korczewski.de
- 4.conf: embeddings.korczewski.de
- 5.conf: qdrant.korczewski.de
- 6.conf: nginx.korczewski.de
- 7.conf: dashboard.korczewski.de
- 8.conf: l2p.korczewski.de
- 10.conf: auth.korczewski.de → host.docker.internal:5500

**Note**: Configuration files can be edited via:
1. Web UI at http://10.0.0.46:81 (recommended)
2. Direct file editing at `/home/patrick/projects/reverse-proxy/nginx/proxy_host/*.conf`
3. SFTP/SSH access to server

## SSL Certificates

Let's Encrypt SSL certificates are automatically managed by Nginx Proxy Manager and stored in `./letsencrypt/`.

## Remote Configuration Management

### Option 1: Web UI via SSH Tunnel (Recommended)
**Step 1**: Establish SSH tunnel (if not already running):
```bash
ssh -i /mnt/c/Users/PatrickKorczewski/.ssh/id_ed25519 \
    -L 8081:localhost:81 -L 8080:localhost:80 -L 8443:localhost:443 \
    -N -f patrick@10.0.0.46
```

**Step 2**: Access the admin interface locally at **http://localhost:8081** to:
- Add/edit/delete proxy hosts
- Manage SSL certificates
- View access logs
- Configure advanced settings

**Quick Actions:**
- Add new proxy host: http://localhost:8081 → Hosts → Proxy Hosts → Add Proxy Host
- Renew SSL cert: http://localhost:8081 → SSL Certificates → Request New Certificate
- View logs: http://localhost:8081 → Hosts → (click on host) → Advanced tab

### Option 2: Direct Config File Editing via SSH
Configuration files are stored in `/home/patrick/nginxproxymanager` on the remote server:

```bash
# SSH into the server
ssh patrick@10.0.0.46

# Navigate to config directory
cd /home/patrick/nginxproxymanager

# Edit a configuration file
vim nginx/proxy_host/10.conf

# Reload Nginx after changes
docker-compose exec nginx-proxy-manager nginx -s reload
# OR restart the container
docker-compose restart
```

### Option 3: Remote File Editing via VS Code Remote-SSH

**Setup**:
1. Install "Remote - SSH" extension in VS Code
2. Add to your SSH config (`~/.ssh/config` or `C:\Users\PatrickKorczewski\.ssh\config`):
   ```
   Host nginx-proxy
       HostName 10.0.0.46
       User patrick
       IdentityFile C:\Users\PatrickKorczewski\.ssh\id_ed25519
       RemoteCommand cd /home/patrick/nginxproxymanager && exec $SHELL
   ```
3. In VS Code: `Ctrl+Shift+P` → "Remote-SSH: Connect to Host" → Select `nginx-proxy`
4. Open folder: `/home/patrick/nginxproxymanager`

**Key directories**:
- `nginx/proxy_host/` - Proxy host configurations (*.conf)
- `data/` - SQLite database and logs
- `letsencrypt/` - SSL certificates

### Option 4: SFTP Clients (FileZilla, WinSCP)
- **Host**: `10.0.0.46`
- **User**: `patrick`
- **Key**: `C:\Users\PatrickKorczewski\.ssh\id_ed25519`
- **Remote Path**: `/home/patrick/nginxproxymanager`

Edit files locally, changes sync automatically after saving.

## Troubleshooting

### SSH Tunnel Issues

**Tunnel not connecting:**
```bash
# Test SSH connection first
ssh patrick@10.0.0.46 "echo 'Connection successful'"

# Check if SSH key permissions are correct (should be 600)
# On Windows/WSL, keys on /mnt/c may have permission issues
# Copy key to WSL home directory:
cp /mnt/c/Users/PatrickKorczewski/.ssh/id_ed25519 ~/.ssh/
chmod 600 ~/.ssh/id_ed25519

# Then use local key:
ssh -i ~/.ssh/id_ed25519 -L 8081:localhost:81 -N -f patrick@10.0.0.46
```

**Ports already in use:**
```bash
# Find and kill existing tunnel
ps aux | grep "ssh.*10.0.0.46" | grep -v grep
kill <PID>

# Or kill all tunnels to this server
pkill -f "ssh.*10.0.0.46"

# Then re-establish tunnel
ssh -i ~/.ssh/id_ed25519 -L 8081:localhost:81 -L 8080:localhost:80 -L 8443:localhost:443 -N -f patrick@10.0.0.46
```

**Tunnel established but can't access admin UI:**
```bash
# Test if tunnel is forwarding correctly
curl -I http://localhost:8081

# Check tunnel process is running
netstat -tlnp | grep -E ":(8081|8080|8443)"

# Verify remote service is running
ssh patrick@10.0.0.46 "docker-compose -f /home/patrick/nginxproxymanager/docker-compose.yml ps"
```

### Service not accessible
1. **Via SSH Tunnel**: Ensure tunnel is active: `ps aux | grep "ssh.*10.0.0.46"`
2. **On Remote Server**:
   ```bash
   ssh patrick@10.0.0.46
   cd /home/patrick/nginxproxymanager
   docker-compose ps
   docker-compose logs -f
   ```
3. Verify the target service is running
4. For host services (like tsx watch), use `host.docker.internal` instead of `10.10.0.3`
5. Verify firewall allows access to ports 80, 443, and 81

### Remote access to admin interface
If you cannot access the admin interface:
1. **First try SSH tunnel**: http://localhost:8081 (after establishing tunnel)
2. **Direct network access**: http://10.0.0.46:81 (only works if on same network)
3. Check if Nginx Proxy Manager is running:
   ```bash
   ssh patrick@10.0.0.46 "cd /home/patrick/nginxproxymanager && docker-compose ps"
   ```
4. Verify firewall rules on server:
   ```bash
   ssh patrick@10.0.0.46 "sudo ufw status"
   ```

### Update target IP for auth service
If your auth service runs on the host (not in Docker), update the proxy configuration to use:
- `host.docker.internal:5500` instead of `10.10.0.3:5500`

This can be done via the web UI at http://localhost:8081 (via tunnel) or by editing the conf files directly via SSH.
