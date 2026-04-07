FROM node:20-slim

WORKDIR /app

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY . .

RUN rm -f backend/.env backend/package-lock.json

RUN cd backend && npm install --no-package-lock

# Debug: verificar que los modulos criticos existen
RUN node -e "require('@anthropic-ai/sdk')" --prefix backend && echo "anthropic OK" || echo "anthropic MISSING"
RUN node -e "require('sequelize')" --prefix backend && echo "sequelize OK" || echo "sequelize MISSING"
RUN node -e "require('express')" --prefix backend && echo "express OK" || echo "express MISSING"

RUN cd frontend && npm install --legacy-peer-deps && npm run build

EXPOSE 8080

CMD ["node", "backend/server.js"]
