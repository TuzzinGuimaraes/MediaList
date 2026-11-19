# Contexto: a raiz do repositório (docker-compose.yml: context ".", dockerfile Web/Dockerfile),
# porque o Web importa ../design, ../contrato e ../dominio. O que entra no contexto está em
# Web/Dockerfile.dockerignore.
FROM node:24-alpine AS build

WORKDIR /src/Web

COPY Web/package.json Web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY design /src/design
COPY contrato /src/contrato
COPY dominio /src/dominio
COPY Web /src/Web

# A API fica no mesmo domínio: o cliente chama /api e o nginx encaminha ao backend.
RUN npm run build

FROM nginx:1.29-alpine

COPY Web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/Web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
