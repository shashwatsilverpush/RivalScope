FROM node:22-alpine

WORKDIR /app

# ── frontend build ────────────────────────────────────────────────────────────
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend --silent

COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# ── backend deps ──────────────────────────────────────────────────────────────
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --silent

COPY backend/ ./backend/

# ── root manifest ─────────────────────────────────────────────────────────────
COPY package.json .

# Railway mounts a persistent volume at /data — DB lives there
ENV DB_PATH=/data/rivalscope.db
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/index.js"]
