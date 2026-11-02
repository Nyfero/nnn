# Contexte de build : racine du repo
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json packages/ui/
COPY packages/sdk/package.json packages/sdk/
COPY modules/vpn/frontend/package.json modules/vpn/frontend/
RUN npm install --no-audit --no-fund
COPY packages packages
COPY modules/vpn/frontend modules/vpn/frontend
RUN npm run build --workspace=modules/vpn/frontend

FROM nginx:alpine
COPY modules/vpn/frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Servi sous /vpn/ : les fichiers vivent dans un sous-dossier du même nom
COPY --from=build /app/modules/vpn/frontend/dist /usr/share/nginx/html/vpn
