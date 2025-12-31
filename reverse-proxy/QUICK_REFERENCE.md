# Nginx Proxy Manager - Quick Reference

## Access Points
- **Web UI (via SSH Tunnel)**: http://localhost:8081 ⭐ **Recommended**
- **Web UI (Direct Network)**: http://10.0.0.46:81
- **Server IP**: 10.0.0.46/8
- **Remote Directory**: `/home/patrick/nginxproxymanager`

## SSH Tunnel Setup

### Establish Tunnel (One-Time)
```bash
# From WSL/Linux
ssh -i ~/.ssh/id_ed25519 -L 8081:localhost:81 -L 8080:localhost:80 -L 8443:localhost:443 -N -f patrick@10.0.0.46

# From Windows PowerShell
ssh -i C:\Users\PatrickKorczewski\.ssh\id_ed25519 -L 8081:localhost:81 -L 8080:localhost:80 -L 8443:localhost:443 -N -f patrick@10.0.0.46
```

### Check Tunnel Status
```bash
# Check if running
ps aux | grep "ssh.*10.0.0.46" | grep -v grep

# Test connection
curl -I http://localhost:8081
```

### Kill Tunnel
```bash
# Find process
ps aux | grep "ssh.*10.0.0.46" | grep -v grep

# Kill by PID
kill <PID>

# Or kill all
pkill -f "ssh.*10.0.0.46"
```

## Common Tasks

### Add New Proxy Host (Web UI)
1. **Ensure SSH tunnel is active** (see SSH Tunnel Setup above)
2. Navigate to http://localhost:8081
3. Login with your credentials
4. Go to: **Hosts** → **Proxy Hosts** → **Add Proxy Host**
5. Fill in:
   - Domain Names: `example.korczewski.de`
   - Forward Hostname/IP: `host.docker.internal` (for host services) or Docker container IP
   - Forward Port: Service port (e.g., 5500)
6. Enable SSL tab to add Let's Encrypt certificate

### Edit Existing Proxy (Web UI)
1. http://localhost:8081 → **Hosts** → **Proxy Hosts**
2. Click the three dots on the host → **Edit**
3. Make changes → **Save**

### Edit Config Files Directly
```bash
# SSH into server
ssh patrick@10.0.0.46

# Navigate to config directory
cd /home/patrick/projects/reverse-proxy/nginx/proxy_host

# Edit a config file
vim 10.conf

# Reload Nginx
docker-compose exec nginx-proxy-manager nginx -s reload
```

### View Logs
```bash
# Access logs for specific host
docker-compose exec nginx-proxy-manager tail -f /data/logs/proxy-host-10_access.log

# Error logs
docker-compose exec nginx-proxy-manager tail -f /data/logs/proxy-host-10_error.log

# All logs
docker-compose logs -f
```

### Restart Proxy Manager
```bash
cd /home/patrick/projects/reverse-proxy
docker-compose restart
```

### Check Status
```bash
cd /home/patrick/projects/reverse-proxy
docker-compose ps
docker-compose logs --tail=50
```

## Current Proxy Hosts

| ID | Domain | Target | Notes |
|----|--------|--------|-------|
| 1 | chat.korczewski.de | - | - |
| 2 | forge.korczewski.de | - | - |
| 3 | api.korczewski.de | - | - |
| 4 | embeddings.korczewski.de | - | - |
| 5 | qdrant.korczewski.de | - | - |
| 6 | nginx.korczewski.de | - | - |
| 7 | dashboard.korczewski.de | - | - |
| 8 | l2p.korczewski.de | - | - |
| 10 | auth.korczewski.de | host.docker.internal:5500 | Auth service |

## Network Information

### Docker Network
- Network Name: `proxy-network`
- Subnet: `10.10.0.0/24`
- Gateway: `10.10.0.1`

### Connecting Other Services
Add to service's `docker-compose.yml`:
```yaml
networks:
  default:
    name: proxy-network
    external: true
```

## File Locations

**Remote Server** (10.0.0.46):
```
/home/patrick/nginxproxymanager/
├── docker-compose.yml           # Main configuration
├── data/                        # SQLite database and logs
│   ├── database.sqlite          # Proxy configuration database
│   ├── logs/                    # Access and error logs
│   └── nginx/                   # Runtime Nginx configs
├── letsencrypt/                 # SSL certificates
│   └── live/                    # Active certificates
└── nginx/proxy_host/            # Proxy host configurations
    ├── 1.conf                   # chat.korczewski.de
    ├── 2.conf                   # forge.korczewski.de
    ├── 10.conf                  # auth.korczewski.de
    └── ...
```

**Local** (via git repo):
```
/home/patrick/projects/reverse-proxy/
└── (documentation only - actual config is on remote server)
```

## Remote Editing Options

### Visual Studio Code (Recommended)
1. Install "Remote - SSH" extension
2. Add to SSH config (`~/.ssh/config` or `C:\Users\PatrickKorczewski\.ssh\config`):
   ```
   Host nginx-proxy
       HostName 10.0.0.46
       User patrick
       IdentityFile ~/.ssh/id_ed25519
   ```
3. Connect to `nginx-proxy`
4. Open folder: `/home/patrick/nginxproxymanager`
5. Edit files directly

### FileZilla/WinSCP
- Protocol: SFTP
- Host: `10.0.0.46`
- User: `patrick`
- Key: `C:\Users\PatrickKorczewski\.ssh\id_ed25519`
- Remote directory: `/home/patrick/nginxproxymanager`

### Command Line
```bash
# SSH directly
ssh patrick@10.0.0.46
cd /home/patrick/nginxproxymanager

# Or use SCP to copy files
scp patrick@10.0.0.46:/home/patrick/nginxproxymanager/nginx/proxy_host/10.conf ./
```

## Troubleshooting

### Can't access web UI
```bash
# 1. Check SSH tunnel is active
ps aux | grep "ssh.*10.0.0.46" | grep -v grep

# 2. Test tunnel connection
curl -I http://localhost:8081

# 3. If tunnel not running, establish it
ssh -i ~/.ssh/id_ed25519 -L 8081:localhost:81 -L 8080:localhost:80 -L 8443:localhost:443 -N -f patrick@10.0.0.46

# 4. Check remote service is running
ssh patrick@10.0.0.46 "cd /home/patrick/nginxproxymanager && docker-compose ps"
```

### SSH tunnel issues
```bash
# Ports already in use - kill existing tunnel
pkill -f "ssh.*10.0.0.46"

# SSH key permission errors (WSL)
cp /mnt/c/Users/PatrickKorczewski/.ssh/id_ed25519 ~/.ssh/
chmod 600 ~/.ssh/id_ed25519
ssh -i ~/.ssh/id_ed25519 -L 8081:localhost:81 -N -f patrick@10.0.0.46
```

### Config changes not taking effect
```bash
# SSH into server first
ssh patrick@10.0.0.46
cd /home/patrick/nginxproxymanager

# Method 1: Reload Nginx
docker-compose exec nginx-proxy-manager nginx -s reload

# Method 2: Restart container
docker-compose restart

# Method 3: Full restart
docker-compose down && docker-compose up -d
```

### SSL certificate issues
1. Check Let's Encrypt rate limits (5 per week per domain)
2. Ensure DNS points to correct IP
3. Verify ports 80 and 443 are accessible from internet
4. Check logs: `docker-compose logs | grep -i ssl`

## Security Notes

- Change default admin credentials immediately
- Keep Nginx Proxy Manager updated
- Use strong SSL/TLS settings
- Regularly backup `/home/patrick/projects/reverse-proxy/data/database.sqlite`
- Monitor access logs for suspicious activity
