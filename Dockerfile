FROM node:20-slim

WORKDIR /app

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY . .

RUN rm -f backend/.env backend/package-lock.json

RUN cd backend && npm install --no-package-lock

RUN cd frontend && npm install --legacy-peer-deps && npm run build

EXPOSE 8080

CMD ["node", "backend/server.js"]
