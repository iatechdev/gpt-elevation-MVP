FROM node:20-slim

WORKDIR /app/backend

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY backend/package.json ./
RUN npm install --no-package-lock

WORKDIR /app
COPY . .

RUN rm -f backend/.env

RUN cd frontend && npm install --legacy-peer-deps && npm run build

EXPOSE 8080

CMD ["node", "backend/server.js"]
