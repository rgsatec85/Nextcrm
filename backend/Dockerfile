# Build multi-stage para deploy no Render.com
FROM node:22-alpine AS builder
WORKDIR /app
# Alpine (musl) não vem com OpenSSL por padrão nas imagens node recentes.
# Sem isso, `prisma generate` não detecta a versão de OpenSSL disponível e
# cai no engine legado linkado à libssl 1.1 (que não existe mais no Alpine
# atual), quebrando o boot em produção. Ver binaryTargets em schema.prisma.
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npm run prisma:generate
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main.js"]
