# CLEARANCE API.
#
# Två steg: bygget har hela verktygskedjan, körsteget har bara det som
# behövs för att svara på anrop. Skillnaden är inte storleken utan
# angreppsytan - en container med esbuild och testberoenden installerade
# är en container där en angripare har verktyg.
#
# Avbilden byggs från REPOTS ROT, inte från api/:
#   docker build -f api/Dockerfile -t clearance-api .
# Bygget behöver package.json och api/ tillsammans.

FROM node:20-alpine AS bygge
WORKDIR /bygge
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY api ./api
COPY tsconfig*.json ./
RUN npx esbuild api/server/main.ts \
      --bundle --platform=node --format=cjs --target=node20 \
      --external:pg --outfile=dist/server.cjs --log-level=error

FROM node:20-alpine AS drift
WORKDIR /app
ENV NODE_ENV=production
# Bara pg installeras: allt annat är inbakat i bunten.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY --from=bygge /bygge/dist/server.cjs ./server.cjs

# Aldrig root. Alpine-avbilden har redan användaren "node".
USER node
EXPOSE 8080
# Hälsorutten ALB:n frågar efter. Står här också så att en trasig
# container syns lokalt, innan den når molnet.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:8080/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.cjs"]
