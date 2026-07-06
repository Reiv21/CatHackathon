# Deploy Setup — Raspberry Pi

One-time setup for the Raspberry Pi (`justyn@83.27.179.83`).

## 1. SSH Key for GitHub Actions

On your local machine, generate a deploy key:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/cat_deploy
```

Then add the public key to the Pi:

```bash
ssh-copy-id -i ~/.ssh/cat_deploy.pub justyn@83.27.179.83
```

Add the **private key** (`~/.ssh/cat_deploy`) as a GitHub Secret:
- Go to repo Settings → Secrets → Actions
- Add `DEPLOY_KEY` = contents of `~/.ssh/cat_deploy`
- Add `DEPLOY_HOST` = `83.27.179.83`
- Add `DEPLOY_USER` = `justyn`

## 2. Initial Pi Setup

SSH into the Pi and run:

```bash
# Clone the repo
cd ~
git clone https://github.com/Reiv21/CatHackathon.git cat-hackathon
cd cat-hackathon

# Install PM2 globally
npm install -g pm2

# Install deps & build frontend
npm install --production
cd frontend && npm install && npm run build && cd ..

# Create .env
cp .env.example .env
nano .env  # Set ADMIN_PASSWORD and PORT=3001

# Start server
pm2 start "npx tsx src/server.ts" --name cat-hackathon-server
pm2 save
pm2 startup  # follow the printed command to enable on boot
```

## 3. Nginx Config

Add to `/etc/nginx/sites-available/default` (or a new file):

```nginx
location /cat-hackathon/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
}
```

Then reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Cron Jobs (scraping + cat of the day)

```bash
crontab -e
```

Add:

```cron
# Scrape shelters every 6 hours
0 */6 * * * cd /home/justyn/cat-hackathon && npx tsx src/scrape-all.ts >> /tmp/cat-scrape.log 2>&1

# Rotate "cat of the day" at midnight (optional — endpoint already randomizes)
0 0 * * * curl -s http://localhost:3001/api/cat-of-the-day > /dev/null
```

## 5. Temporal (optional)

Without Temporal, the `/api/admin/sync` endpoint returns 503. The cron-based scraping above works independently of Temporal.

To install Temporal:

```bash
# Install Temporal CLI
curl -sSf https://temporal.download/cli.sh | sh

# Start Temporal dev server (background)
temporal server start-dev &

# Start the Temporal worker
cd ~/cat-hackathon
pm2 start "npx tsx src/worker.ts" --name cat-hackathon-worker
pm2 save
```

## Environment Variables (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| ADMIN_PASSWORD | Admin panel password | (your choice) |
| FRONTEND_ORIGIN | CORS origin | http://serwerigora.com |
| TEMPORAL_ADDRESS | Temporal server | localhost:7233 |
