# Contexte de build : racine du repo
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json packages/ui/
COPY packages/sdk/package.json packages/sdk/
COPY modules/servers/frontend/package.json modules/servers/frontend/
RUN npm install --no-audit --no-fund
COPY packages packages
COPY modules/servers/frontend modules/servers/frontend
RUN npm run build --workspace=modules/servers/frontend

FROM nginx:alpine
COPY modules/servers/frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Servi sous /servers/ : les fichiers vivent dans un sous-dossier du même nom
COPY --from=build /app/modules/servers/frontend/dist /usr/share/nginx/html/servers
