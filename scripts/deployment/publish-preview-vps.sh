#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-/opt/docker/raijin-preview}"
RELEASE="${2:?release directory required}"

mkdir -p "$BASE"
cd "$BASE"

if [ ! -f .env.production ]; then
  JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')"
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  ENCRYPTION_KEY="$(openssl rand -base64 32 | tr '+/' '-_')"
  S3_SECRET_KEY="$(openssl rand -hex 24)"
  cat > .env.production <<EOF
ENVIRONMENT=staging
LOG_LEVEL=INFO
RELEASE_VERSION=$(cat "$RELEASE/release.env" | sed 's/^RELEASE_VERSION=//')
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.0
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_ENVIRONMENT=preview
NEXT_PUBLIC_RELEASE_VERSION=$(cat "$RELEASE/release.env" | sed 's/^RELEASE_VERSION=//')
POSTGRES_USER=raijin
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=raijin
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://raijin:$POSTGRES_PASSWORD@postgres:5432/raijin
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
S3_ENDPOINT_URL=
S3_ACCESS_KEY=preview
S3_SECRET_KEY=$S3_SECRET_KEY
S3_BUCKET_INVOICES=raijin-preview-invoices
S3_REGION=eu-west-1
S3_SIGNED_URL_TTL_SECONDS=900
JWT_SECRET=$JWT_SECRET
JWT_ALGORITHM=HS256
JWT_ACCESS_TTL_MINUTES=60
JWT_REFRESH_TTL_DAYS=14
AZURE_DI_ENDPOINT=
AZURE_DI_KEY=
AZURE_DI_MODEL=prebuilt-invoice
AZURE_DI_LOCALE=el-GR
UPLOAD_MAX_SIZE_MB=20
UPLOAD_ALLOWED_MIME=application/pdf,image/jpeg,image/png
RATE_LIMIT_LOGIN_PER_MIN=100
RATE_LIMIT_REGISTER_PER_MIN=30
NEXT_PUBLIC_API_URL=https://temporary.susanoo.app/raijin-api
NEXT_PUBLIC_BASE_PATH=/raijin
NEXT_PUBLIC_DEFAULT_LOCALE=fr
ENCRYPTION_KEY=$ENCRYPTION_KEY
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT=common
MICROSOFT_REDIRECT_URI=https://temporary.susanoo.app/raijin-api/integrations/outlook/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://temporary.susanoo.app/raijin-api/integrations/google/callback
TRUSTED_PROXIES=127.0.0.1/32,172.16.0.0/12,10.0.0.0/8
EOF
  chmod 600 .env.production
fi

# Older preview releases wrote ENVIRONMENT=preview, which is invalid for the backend settings.
sed -i "s/^ENVIRONMENT=preview$/ENVIRONMENT=staging/" .env.production

# Keep mutable preview metadata in sync on every deployment.
CURRENT_RELEASE_VERSION="$(sed -n 's/^RELEASE_VERSION=//p' "$RELEASE/release.env" | head -n 1)"
if grep -q '^RELEASE_VERSION=' .env.production; then
  sed -i "s/^RELEASE_VERSION=.*/RELEASE_VERSION=$CURRENT_RELEASE_VERSION/" .env.production
else
  printf '\nRELEASE_VERSION=%s\n' "$CURRENT_RELEASE_VERSION" >> .env.production
fi
if grep -q '^NEXT_PUBLIC_RELEASE_VERSION=' .env.production; then
  sed -i "s/^NEXT_PUBLIC_RELEASE_VERSION=.*/NEXT_PUBLIC_RELEASE_VERSION=$CURRENT_RELEASE_VERSION/" .env.production
else
  printf 'NEXT_PUBLIC_RELEASE_VERSION=%s\n' "$CURRENT_RELEASE_VERSION" >> .env.production
fi

cp "$RELEASE/docker-compose.preview.yml" docker-compose.preview.yml
rm -rf shared
cp -R "$RELEASE/shared" shared
cp "$RELEASE/release.env" release.env

if [ -n "${RAIJIN_PREVIEW_GHCR_USER:-}" ] && [ -n "${RAIJIN_PREVIEW_GHCR_TOKEN:-}" ]; then
  printf '%s' "$RAIJIN_PREVIEW_GHCR_TOKEN" | docker login ghcr.io -u "$RAIJIN_PREVIEW_GHCR_USER" --password-stdin
fi

mkdir -p /opt/docker/traefik/config/config
cat > /opt/docker/traefik/config/config/raijin-preview.yml <<'EOF'
http:
  middlewares:
    raijin-api-strip:
      stripPrefix:
        prefixes:
          - /raijin-api
  routers:
    raijin-preview-api:
      entryPoints:
        - websecure
      rule: Host(`temporary.susanoo.app`) && PathPrefix(`/raijin-api`)
      middlewares:
        - raijin-api-strip
      service: raijin-preview-backend
      priority: 90
      tls:
        certResolver: letsencrypt-http
    raijin-preview-frontend:
      entryPoints:
        - websecure
      rule: Host(`temporary.susanoo.app`) && PathPrefix(`/raijin`)
      service: raijin-preview-frontend
      priority: 80
      tls:
        certResolver: letsencrypt-http
  services:
    raijin-preview-backend:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:34200
    raijin-preview-frontend:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:34280
EOF

set -a
. ./.env.production
. ./release.env
set +a
docker compose -f docker-compose.preview.yml up -d --remove-orphans
docker compose -f docker-compose.preview.yml ps

echo "Preview published: https://temporary.susanoo.app/raijin"
