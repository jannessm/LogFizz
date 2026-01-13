# Deployment Guide with Docker and Traefik

This guide covers deploying the Clock application on a production server using Docker Compose and Traefik as a reverse proxy.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Environment Configuration](#environment-configuration)
- [Traefik Setup](#traefik-setup)
- [Application Deployment](#application-deployment)
- [Database Backups](#database-backups)
- [SSL/TLS Certificates](#ssltls-certificates)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Prerequisites

### Server Requirements

- **Operating System**: Ubuntu 22.04 LTS or similar Linux distribution
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk Space**: Minimum 20GB
- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Domain Name**: A registered domain pointing to your server's IP address

### Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not included with Docker)
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### DNS Configuration

Configure your domain's DNS records to point to your server:

```
A    @              your.server.ip.address
A    www            your.server.ip.address
```

---

## Server Setup

### 1. Create Application Directory

```bash
# Create application directory
sudo mkdir -p /opt/clock-app
cd /opt/clock-app

# Clone the repository
git clone https://github.com/jannessm/TapShift.git .

# Set proper permissions
sudo chown -R $USER:$USER /opt/clock-app
```

### 2. Create Docker Network

```bash
# Create a network for Traefik and the application
docker network create traefik-public
```

---

## Environment Configuration

### Backend Environment Variables

Create `/opt/clock-app/backend/.env`:

```bash
# Copy example file
cp backend/.env.example backend/.env

# Edit with your production values
nano backend/.env
```

**Required Backend Environment Variables:**

```bash
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=clock_user
DB_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD
DB_DATABASE=clock_db

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Session Configuration (IMPORTANT: Change this!)
SESSION_SECRET=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_AT_LEAST_32_CHARS

# Application Configuration
NODE_ENV=production

# Frontend URL (your domain)
FRONTEND_URL=https://yourdomain.com

# Email Configuration (for password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
ADMIN_EMAIL=admin@yourdomain.com

# hCaptcha Configuration (optional - for bot protection)
# Get your keys from https://www.hcaptcha.com/
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key
```

### PostgreSQL Environment Variables

Create `/opt/clock-app/.env.postgres`:

```bash
POSTGRES_USER=clock_user
POSTGRES_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD
POSTGRES_DB=clock_db
```

**Important**: Use the same password for `DB_PASSWORD` in backend/.env and `POSTGRES_PASSWORD` here.

### Frontend Environment Variables (if needed)

Create `/opt/clock-app/frontend/.env`:

```bash
# Copy example file
cp frontend/.env.example frontend/.env

# Edit with your production values
nano frontend/.env
```

---

## Traefik Setup

### 1. Create Traefik Configuration Directory

```bash
sudo mkdir -p /opt/traefik
cd /opt/traefik
```

### 2. Create Traefik Configuration File

Create `/opt/traefik/traefik.yml`:

```yaml
# Traefik Static Configuration
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true

  websecure:
    address: ":443"
    http:
      tls:
        certResolver: letsencrypt

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik-public

log:
  level: INFO
  filePath: /var/log/traefik/traefik.log

accessLog:
  filePath: /var/log/traefik/access.log
```

### 3. Create Traefik Docker Compose File

Create `/opt/traefik/docker-compose.yml`:

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    networks:
      - traefik-public
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./letsencrypt:/letsencrypt
      - ./logs:/var/log/traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.yourdomain.com`)"
      - "traefik.http.routers.traefik.entrypoints=websecure"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.service=api@internal"
      - "traefik.http.routers.traefik.middlewares=traefik-auth"
      # Generate password: htpasswd -nb admin your_password
      - "traefik.http.middlewares.traefik-auth.basicauth.users=admin:$$apr1$$xyz$$encrypted_password"

networks:
  traefik-public:
    external: true
```

### 4. Create Required Directories

```bash
cd /opt/traefik
mkdir -p letsencrypt logs
touch letsencrypt/acme.json
chmod 600 letsencrypt/acme.json
```

### 5. Generate Basic Auth Password for Traefik Dashboard

```bash
# Install apache2-utils for htpasswd
sudo apt install apache2-utils

# Generate password (replace 'admin' and 'your_password')
htpasswd -nb admin your_password
# Copy the output and replace the basicauth.users label in docker-compose.yml
# Remember to escape $ characters with $$
```

### 6. Start Traefik

```bash
cd /opt/traefik
docker compose up -d
```

---

## Application Deployment

### 1. Create Production Docker Compose File

Create `/opt/clock-app/docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: clock-postgres
    restart: unless-stopped
    env_file:
      - .env.postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - clock-internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-clock_user} -d ${POSTGRES_DB:-clock_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: clock-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - clock-internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: clock-backend
    restart: unless-stopped
    env_file:
      - ./backend/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - clock-internal
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.clock-backend.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.clock-backend.entrypoints=websecure"
      - "traefik.http.routers.clock-backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.clock-backend.loadbalancer.server.port=3000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: clock-frontend
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.clock-frontend.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
      - "traefik.http.routers.clock-frontend.entrypoints=websecure"
      - "traefik.http.routers.clock-frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.clock-frontend.loadbalancer.server.port=80"

volumes:
  postgres_data:
  redis_data:

networks:
  clock-internal:
    driver: bridge
  traefik-public:
    external: true
```

### 2. Update Configuration

Replace all instances of `yourdomain.com` with your actual domain:

```bash
cd /opt/clock-app
sed -i 's/yourdomain.com/your-actual-domain.com/g' docker-compose.prod.yml
```

### 3. Build and Deploy

```bash
cd /opt/clock-app

# Build the images
docker compose -f docker-compose.prod.yml build

# Start the services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 4. Run Database Migrations

```bash
# Run migrations on the backend container
docker exec -it clock-backend npm run migration:run
```

---

## Database Backups

### 1. Setup Backup Directory

```bash
# Create backup directory
sudo mkdir -p /opt/backups/clock-db
sudo chown -R $USER:$USER /opt/backups
```

### 2. Configure Backup Environment Variables

```bash
# Export variables for backup script (add to ~/.bashrc or ~/.profile)
export POSTGRES_CONTAINER=clock-postgres
export POSTGRES_DB=clock_db
export POSTGRES_USER=clock_user
```

Or create a backup configuration file at `/opt/clock-app/backup.env`:

```bash
POSTGRES_CONTAINER=clock-postgres
POSTGRES_DB=clock_db
POSTGRES_USER=clock_user
```

### 3. Setup Automated Backups with Cron

```bash
# Edit crontab
crontab -e

# Add the following line for daily backups at 2:00 AM
0 2 * * * cd /opt/clock-app && ./scripts/backup-postgres.sh /opt/backups/clock-db >> /opt/backups/clock-db/cron.log 2>&1
```

**Alternative**: Source environment variables from file:

```bash
0 2 * * * cd /opt/clock-app && source /opt/clock-app/backup.env && ./scripts/backup-postgres.sh /opt/backups/clock-db >> /opt/backups/clock-db/cron.log 2>&1
```

### 4. Test Backup

```bash
cd /opt/clock-app
./scripts/backup-postgres.sh /opt/backups/clock-db

# Verify backup was created
ls -lh /opt/backups/clock-db/daily/
```

### 5. Backup Retention

The backup script automatically maintains:
- **14 daily backups** (last 2 weeks)
- **3 monthly backups** (last 3 months)

Backups are stored in:
```
/opt/backups/clock-db/
├── daily/           # Last 14 daily backups
├── monthly/         # Last 3 monthly backups
└── backup.log       # Backup operations log
```

### 6. Remote Backup Storage (Recommended)

For disaster recovery, sync backups to remote storage:

```bash
# Install rclone for cloud storage sync
curl https://rclone.org/install.sh | sudo bash

# Configure rclone (follow interactive setup)
rclone config

# Add to crontab to sync backups daily at 3:00 AM
0 3 * * * rclone sync /opt/backups/clock-db your-remote:clock-backups >> /opt/backups/rclone.log 2>&1
```

---

## SSL/TLS Certificates

Traefik automatically obtains and renews SSL certificates from Let's Encrypt.

### Verify Certificate

```bash
# Check certificate status
docker exec traefik cat /letsencrypt/acme.json | jq

# Test HTTPS connection
curl -I https://yourdomain.com
```

### Certificate Renewal

Traefik handles automatic renewal. Certificates are renewed ~30 days before expiry.

---

## Monitoring and Maintenance

### View Logs

```bash
# Application logs
cd /opt/clock-app
docker compose -f docker-compose.prod.yml logs -f

# Specific service logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f postgres

# Traefik logs
cd /opt/traefik
docker compose logs -f
tail -f logs/traefik.log
tail -f logs/access.log
```

### Update Application

```bash
cd /opt/clock-app

# Pull latest changes
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run migrations if needed
docker exec -it clock-backend npm run migration:run
```

### Health Checks

```bash
# Check service status
docker compose -f docker-compose.prod.yml ps

# Health check endpoints
curl https://api.yourdomain.com/health
curl https://yourdomain.com
```

### Restart Services

```bash
cd /opt/clock-app

# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### Stop Services

```bash
cd /opt/clock-app
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (WARNING: deletes data)
docker compose -f docker-compose.prod.yml down -v
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated strong `SESSION_SECRET` (32+ characters)
- [ ] Configured firewall (ufw/iptables) to only allow ports 80, 443, and SSH
- [ ] Set up SSH key authentication and disabled password login
- [ ] Configured automatic security updates
- [ ] Set up monitoring/alerting
- [ ] Configured database backups with remote storage
- [ ] Reviewed and secured Traefik dashboard access
- [ ] Enabled fail2ban for SSH protection
- [ ] Set up log rotation

### Firewall Configuration

```bash
# Install and configure UFW
sudo apt install ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs service-name

# Check container status
docker ps -a

# Restart container
docker compose -f docker-compose.prod.yml restart service-name
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker exec -it clock-postgres pg_isready -U clock_user

# Connect to database
docker exec -it clock-postgres psql -U clock_user -d clock_db

# Check environment variables
docker exec clock-backend env | grep DB_
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker logs traefik

# Verify DNS propagation
nslookup yourdomain.com

# Check acme.json
docker exec traefik cat /letsencrypt/acme.json
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a

# Remove old images
docker image prune -a

# Clean logs
sudo truncate -s 0 /opt/traefik/logs/*.log
```

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/jannessm/TapShift/issues
- Documentation: https://github.com/jannessm/TapShift/docs
