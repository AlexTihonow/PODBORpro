FROM node:24-slim
WORKDIR /app
ENV LAYA_CACHE=/models
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY laya.revision tsconfig.json ./
COPY src ./src
VOLUME /models
EXPOSE 8000
CMD ["node", "src/server.ts"]
