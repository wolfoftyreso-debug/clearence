# CLEARANCE aviseringsarbetare (notification-worker).
#
# Egen binär, egen avbild - db/Dockerfile bygger bara e-postarbetaren.
# Kör kontinuerligt (var 5:e minut internt): tömmer verifierings-SMS-kön och
# aviseringskön, beslutar per rad, skickar e-post (via mejltransporten) eller
# SMS (46elks). Ingen port, ingen hälsorutt - den vaknar och arbetar.
#
# Byggs från REPOTS ROT:
#   docker build -f deploy/notification/Dockerfile -t clearance-notification .

FROM node:20-alpine AS bygge
WORKDIR /bygge
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY db ./db
COPY src ./src
COPY tsconfig*.json ./
RUN npx esbuild db/worker/notification-worker.ts \
      --bundle --platform=node --format=cjs --target=node20 \
      --external:pg --external:@aws-sdk/client-ses --external:nodemailer \
      --outfile=dist/notification-worker.cjs --log-level=error

FROM node:20-alpine AS drift
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY --from=bygge /bygge/dist/notification-worker.cjs ./notification-worker.cjs

USER node
CMD ["node", "notification-worker.cjs"]
