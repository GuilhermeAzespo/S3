# 1. Build do Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. Build do Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate
# Assumindo que teremos um script de build no package.json do backend
RUN npm run build

# 3. Imagem Final
FROM node:20-alpine
WORKDIR /app

# Instalar dependências necessárias para o SQLite e prisma rodar no Alpine se precisar
RUN apk add --no-cache openssl

# Copiar backend
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/prisma ./backend/prisma

# Copiar frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_PATH=/app/frontend/dist
ENV STORAGE_PATH=/app/storage
ENV DATABASE_URL=file:/app/storage/s3.db

# Criar pasta de storage
RUN mkdir -p /app/storage

WORKDIR /app/backend
EXPOSE 3000

# Executar migrações do banco e iniciar o servidor
CMD npx prisma db push --accept-data-loss && node dist/index.js
