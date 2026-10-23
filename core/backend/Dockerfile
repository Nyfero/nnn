# Contexte de build : racine du repo (docker-compose.yml)
FROM node:22-slim
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY core/backend/package.json core/backend/
RUN npm install --workspace=core/backend --no-audit --no-fund
COPY core/backend core/backend
WORKDIR /app/core/backend
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "./docker-entrypoint.sh"]
