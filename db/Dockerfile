# CLEARANCE utskicksarbetare.
#
# Samma tvåstegsupplägg som API:t. Arbetaren har ingen port och ingen
# hälsorutt - den vaknar, tömmer utkorgen och lägger sig. Att den lever
# syns i CloudWatch och i utkorgens egen vy, inte i en ALB.
#
# Byggs från repots rot:
#   docker build -f db/Dockerfile -t clearance-worker .

FROM node:20-alpine AS bygge
WORKDIR /bygge
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY db ./db
COPY src ./src
COPY tsconfig*.json ./
RUN npx esbuild db/worker/email-worker.ts \
      --bundle --platform=node --format=cjs --target=node20 \
      --external:pg --external:@aws-sdk/client-ses --external:nodemailer \
      --outfile=dist/worker.cjs --log-level=error

FROM node:20-alpine AS drift
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY --from=bygge /bygge/dist/worker.cjs ./worker.cjs

USER node
# Utan argument tömmer arbetaren utkorgen. Faktureringskörningarna
# startas som separata uppgifter med --invoice-referrals respektive
# --invoice-usage; se docs/driftsattning.md.
CMD ["node", "worker.cjs"]
