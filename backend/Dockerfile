FROM node:22.14-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 4000

CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
