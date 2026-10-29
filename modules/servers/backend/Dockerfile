# Contexte de build : racine du repo
FROM node:22-slim
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY modules/servers/backend/package.json modules/servers/backend/
RUN npm install --workspace=modules/servers/backend --no-audit --no-fund
COPY packages/sdk packages/sdk
COPY modules/servers/backend modules/servers/backend
WORKDIR /app/modules/servers/backend
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "./docker-entrypoint.sh"]
