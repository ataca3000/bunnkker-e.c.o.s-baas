#!/usr/bin/env bash
# NAME: SSL / TLS
# Validates SSL certificate configuration:
#   - Certificate files exist (Let's Encrypt or custom)
#   - Certificate is not expired
#   - Certificate expires more than 14 days from now (warn) / 30 days (ok)
#   - nginx config references valid cert paths
#   - Certificate domain matches APP_URL
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
ENV_FILE="$PROJECT_ROOT/backend/.env"
NGINX_CONF="$PROJECT_ROOT/docker/nginx/default.conf"

FAILURES=0
WARNINGS=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  OK: $*"; }
info() { echo "INFO: $*"; }

# ── Extract APP_URL domain ───────────────────────────────────────────────────
APP_URL=""
[[ -f "$ENV_FILE" ]] && APP_URL=$(grep -E "^APP_URL=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')
DOMAIN=$(echo "$APP_URL" | sed 's|https\?://||' | sed 's|/.*||')

if echo "$DOMAIN" | grep -qiE 'localhost|127\.0\.0\.1'; then
  info "APP_URL is localhost — SSL check is informational only (not required for local dev)"
  is_local=1
else
  is_local=0
  ok "Domain from APP_URL: $DOMAIN"
fi

# ── Check nginx SSL configuration ─────────────────────────────────────────────
if [[ ! -f "$NGINX_CONF" ]]; then
  warn "docker/nginx/default.conf not found — cannot verify SSL config"
else
  if grep -qE "listen 443 ssl" "$NGINX_CONF"; then
    ok "nginx configured to listen on 443 (SSL)"

    # Extract certificate path from nginx config
    CERT_PATH=$(grep -oE 'ssl_certificate\s+[^;]+' "$NGINX_CONF" | head -1 | awk '{print $2}')
    KEY_PATH=$(grep -oE 'ssl_certificate_key\s+[^;]+' "$NGINX_CONF" | head -1 | awk '{print $2}')

    if [[ -n "$CERT_PATH" ]]; then
      ok "ssl_certificate path: $CERT_PATH"
    else
      fail "ssl_certificate directive not found in nginx config"
    fi

    if [[ -n "$KEY_PATH" ]]; then
      ok "ssl_certificate_key path: $KEY_PATH"
    else
      fail "ssl_certificate_key directive not found in nginx config"
    fi
  else
    if [[ $is_local -eq 0 ]]; then
      warn "nginx is not configured for HTTPS (port 443) — required for production"
    else
      info "nginx not configured for HTTPS — acceptable for local development"
    fi
  fi
fi

# ── Check Let's Encrypt directory ────────────────────────────────────────────
LETSENCRYPT="/etc/letsencrypt"
if [[ -d "$LETSENCRYPT" ]]; then
  ok "Let's Encrypt directory exists at /etc/letsencrypt"

  # Find live certificates
  while IFS= read -r -d '' certdir; do
    cert_domain="$(basename "$certdir")"
    cert_file="$certdir/fullchain.pem"

    if [[ ! -f "$cert_file" ]]; then
      warn "Expected cert file missing: $cert_file"
      continue
    fi

    # Check expiry using openssl
    if command -v openssl &>/dev/null; then
      expiry=$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | cut -d= -f2)
      if [[ -z "$expiry" ]]; then
        warn "Cannot read expiry from $cert_file"
        continue
      fi

      expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null || \
                     python3 -c "import datetime; print(int(datetime.datetime.strptime('$expiry', '%b %d %H:%M:%S %Y %Z').timestamp()))" 2>/dev/null || echo 0)
      now_epoch=$(date +%s)
      days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

      if [[ $days_left -le 0 ]]; then
        fail "Certificate for $cert_domain EXPIRED ($expiry)"
      elif [[ $days_left -le 14 ]]; then
        fail "Certificate for $cert_domain expires in $days_left day(s) ($expiry) — renew immediately"
      elif [[ $days_left -le 30 ]]; then
        warn "Certificate for $cert_domain expires in $days_left day(s) ($expiry) — renew soon"
      else
        ok "Certificate for $cert_domain valid for $days_left more day(s) (expires $expiry)"
      fi

      # Check domain match
      if [[ -n "$DOMAIN" ]] && [[ $is_local -eq 0 ]]; then
        cert_cn=$(openssl x509 -subject -noout -in "$cert_file" 2>/dev/null | grep -oE 'CN\s*=\s*[^,/]+' | head -1 | cut -d= -f2 | xargs)
        san=$(openssl x509 -text -noout -in "$cert_file" 2>/dev/null | grep -oE "DNS:[^,]+" | tr -d 'DNS:' | tr '\n' ' ')
        if echo "$cert_cn $san" | grep -qF "$DOMAIN"; then
          ok "Certificate covers domain $DOMAIN"
        else
          warn "Certificate CN='$cert_cn' may not cover $DOMAIN — check SANs"
        fi
      fi
    else
      info "openssl not available — cannot check certificate expiry for $cert_domain"
    fi
  done < <(find "$LETSENCRYPT/live" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
else
  if [[ $is_local -eq 0 ]]; then
    warn "/etc/letsencrypt not found — SSL certificates not provisioned"
    info "Run: certbot certonly --nginx -d $DOMAIN"
  else
    info "/etc/letsencrypt not found — not required for local development"
  fi
fi

# ── Check live SSL via curl (if domain is reachable) ─────────────────────────
if [[ $is_local -eq 0 ]] && [[ -n "$DOMAIN" ]] && command -v curl &>/dev/null; then
  result=$(curl -sI --max-time 5 "https://$DOMAIN/api/health" -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")
  if [[ "$result" != "000" ]]; then
    ok "HTTPS connection to $DOMAIN → HTTP $result"
  else
    info "Cannot reach https://$DOMAIN — server may be down or DNS not configured"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ $FAILURES -gt 0 ]]; then
  printf '%d SSL failure(s), %d warning(s)\n' "$FAILURES" "$WARNINGS"
  exit 1
fi

exit 0
