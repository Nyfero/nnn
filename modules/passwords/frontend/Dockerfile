# Contexte de build : racine du repo
FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/ui/package.json packages/ui/
COPY packages/sdk/package.json packages/sdk/
COPY modules/passwords/frontend/package.json modules/passwords/frontend/
RUN npm install --no-audit --no-fund
COPY packages packages
COPY modules/passwords/frontend modules/passwords/frontend
RUN npm run build --workspace=modules/passwords/frontend

FROM nginx:alpine
COPY modules/passwords/frontend/nginx.conf /etc/nginx/conf.d/default.conf
# Servi sous /passwords/ : les fichiers vivent dans un sous-dossier du même nom
COPY --from=build /app/modules/passwords/frontend/dist /usr/share/nginx/html/passwords
