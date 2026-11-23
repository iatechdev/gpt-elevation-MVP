FROM node:20-slim

WORKDIR /app

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
# Banderas de frontend que se leen al construir (Vite). Vacías = apagadas. Solo se definen en Railway donde se decida (ES-13).
ARG VITE_ENABLE_COMPASS_CHAT
ENV VITE_ENABLE_COMPASS_CHAT=$VITE_ENABLE_COMPASS_CHAT
# ES-173: «Tu opinión» real (servidor). Vacía = apagada. Solo se enciende en Railway staging por decisión de Mauricio.
ARG VITE_ENABLE_PILOT_FEEDBACK_LIVE
ENV VITE_ENABLE_PILOT_FEEDBACK_LIVE=$VITE_ENABLE_PILOT_FEEDBACK_LIVE
# ES-237 (ES-400): rutas, experimentos y plan (/app/next-step). Vacía = apagada. Solo se enciende en Railway staging (D1, 23-nov-2026); producción no la define.
ARG VITE_ENABLE_CAREER_PREVIEW
ENV VITE_ENABLE_CAREER_PREVIEW=$VITE_ENABLE_CAREER_PREVIEW

COPY . .

RUN rm -f backend/.env backend/package-lock.json

# Sin devDependencies: embedded-postgres (solo para `npm run db:local`) no debe entrar a la imagen de producción (ES-82).
RUN cd backend && npm install --no-package-lock --omit=dev

RUN cd frontend && npm install --legacy-peer-deps && npm run build

EXPOSE 8080

# ES-115 (ES-59, fase 2): primero se aplican las migraciones pendientes y solo si terminan bien arranca el servidor.
# Si migrate-deploy falla (o la base tiene esquema sin adoptar) el contenedor sale con error y no sirve tráfico.
# Se hace aquí y no con preDeployCommand de railway.json porque Railway no lo ejecutó en la prueba del entorno pr-87.
CMD ["sh", "-c", "node backend/scripts/migrate-deploy.cjs && exec node backend/server.js"]
