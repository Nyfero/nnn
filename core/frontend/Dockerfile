# Contexte de build : racine du repo
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json packages/ui/
COPY packages/sdk/package.json packages/sdk/
COPY core/frontend/package.json core/frontend/
RUN npm install --no-audit --no-fund
COPY packages packages
COPY core/frontend core/frontend
RUN npm run build --workspace=core/frontend

FROM nginx:alpine
COPY core/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/core/frontend/dist /usr/share/nginx/html
