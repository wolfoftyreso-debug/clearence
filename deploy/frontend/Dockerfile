# CLEARANCE frontend: SPA:n + nginx, på samma origin som API:t.
#
# Byggs från REPOTS ROT:
#   docker build -f deploy/frontend/Dockerfile -t clearance-frontend .
#
# EN avbild, alla miljöer. API-basen bakas INTE in - den skjuts in vid
# START av /docker-entrypoint.d/40-clearance-runtime-config.sh ur
# API_BASE_URL. Se docs/selfhosted-kubernetes.md.

FROM node:20-alpine AS bygge
WORKDIR /bygge
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Egen server-adapter, aldrig demo. Supabase-platshållarna krävs för att
# klienten ska kunna konstrueras: halvmigrerade DataPort-portar delegerar
# ännu dit (strangler), tills migreringen är klar. En skarp miljö sätter
# riktiga Supabase-värden som byggargument tills dess - eller inga, när
# migreringen är klar och delegeringen borta.
ARG VITE_SUPABASE_URL=https://placeholder.invalid
ARG VITE_SUPABASE_PUBLISHABLE_KEY=placeholder
ENV VITE_DATA_ADAPTER=aws \
    VITE_DEMO_MODE=false \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

# nginx-unprivileged: lyssnar på 8080 och kör som uid 101, aldrig root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS drift
# Template-mekanismen i basavbilden gör envsubst på *.template vid start.
COPY deploy/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
# Körs före nginx startar och injicerar runtime-konfigen i index.html.
COPY deploy/frontend/40-clearance-runtime-config.sh /docker-entrypoint.d/40-clearance-runtime-config.sh
# Den byggda appen. --chown så uid 101 kan skriva om index.html vid start.
COPY --from=bygge --chown=101:101 /bygge/dist /usr/share/nginx/html

# Default-uppström: API-tjänsten i samma namespace. Kan överlagras.
ENV API_UPSTREAM=http://clearance-api:8080 \
    API_BASE_URL=""

USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/index.html >/dev/null 2>&1 || exit 1
