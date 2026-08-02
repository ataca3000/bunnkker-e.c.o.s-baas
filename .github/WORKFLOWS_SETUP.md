# GitHub Actions Setup Guide

## Workflows Created

### 1. `ci-cd.yml` (Main Pipeline)
Runs on every push to `main` or `develop`, and on all pull requests.

**Jobs:**
- **lint**: ESLint + TypeScript type-checking
- **test**: Vitest unit tests
- **build**: Docker build with GitHub Container Registry (GHCR) push (main only)
- **docker-test**: Test built image on PRs
- **security**: npm audit for vulnerabilities

### 2. `deploy-docker-hub.yml` (Docker Hub Deployment)
Pushes to Docker Hub on pushes to `main` and version tags.

---

## Setup Instructions

### GitHub Container Registry (Automatic)
GHCR uses `GITHUB_TOKEN` which is automatically available. No setup needed—the main CI/CD workflow will push images to `ghcr.io/your-org/your-repo` on merges to `main`.

### Docker Hub (Optional)
To push to Docker Hub, add these secrets to your repository:

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add:
   - Name: `DOCKER_HUB_USERNAME` → Value: Your Docker Hub username
   - Name: `DOCKER_HUB_TOKEN` → Value: Your Docker Hub Personal Access Token

**To create a Docker Hub token:**
- Log into Docker Hub
- Account Settings → Security → Personal Access Tokens
- Create token with **Read, Write, Delete** permissions

### Environment Variables
If your app needs build-time secrets or environment variables:

1. Add secrets via **Settings → Secrets and variables → Actions**
2. Reference in workflow with `secrets.SECRET_NAME`

Example (if you need Firebase config):
```yaml
- name: Build Docker image
  env:
    FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
  run: docker build -t app .
```

---

## How the Workflows Work

### On Pull Request
- ✅ Lint & type-check
- ✅ Run tests
- ✅ Build Docker image (no push)
- ✅ Test Docker image locally
- ✅ Security scan

### On Push to `main`
- ✅ All PR checks above
- ✅ Push to GHCR: `ghcr.io/your-org/your-repo:main`
- ✅ Push to Docker Hub (if secrets configured)

### On Version Tag (v1.0.0)
- ✅ Push to GHCR with version tag
- ✅ Push to Docker Hub with version tag and `latest`

---

## Customization

### Add Playwright Tests
If you want to run E2E tests:

```yaml
- name: Run Playwright tests
  run: npm run test:e2e
```

### Add Database Migrations
For Prisma migrations in CI:

```yaml
- name: Run Prisma migrations
  run: npx prisma migrate deploy
```

### Skip Docker Build
Comment out the `build` job if you don't need container registry pushes.

### Change Branch Triggers
Edit the `on.push.branches` array in each workflow to match your branch strategy.

---

## Monitoring

Check workflow status:
1. Go to **Actions** tab in your repository
2. Click workflow run to see logs
3. Failed jobs show detailed error output

---

## Image References

After setup, your images will be available at:

**GitHub Container Registry:**
```
ghcr.io/your-org/your-repo:main
ghcr.io/your-org/your-repo:sha-abc123def
```

**Docker Hub** (if configured):
```
your-username/bunkker-erp:main
your-username/bunkker-erp:v1.0.0
your-username/bunkker-erp:latest
```

Pull with:
```bash
docker pull ghcr.io/your-org/your-repo:main
```
