FROM node:20-slim

WORKDIR /app

# Copiar todo EXCEPTO lo que está en .dockerignore
COPY . .

# Eliminar .env para que Cloud Run use sus propias variables
RUN rm -f backend/.env

# Instalar dependencias del backend
RUN cd backend && npm install

# Build del frontend
RUN cd frontend && npm install --legacy-peer-deps && npm run build

EXPOSE 8080

CMD ["node", "backend/server.js"]