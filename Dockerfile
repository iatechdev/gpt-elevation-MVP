FROM node:20-slim

WORKDIR /app

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY . .

RUN rm -f backend/.env backend/package-lock.json

# Sin devDependencies: embedded-postgres (solo para `npm run db:local`) no debe entrar a la imagen de producción (ES-82).
RUN cd backend && npm install --no-package-lock --omit=dev

RUN cd frontend && npm install --legacy-peer-deps && npm run build

EXPOSE 8080

CMD ["node", "backend/server.js"]
