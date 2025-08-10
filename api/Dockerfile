# Build stage
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY prisma/seed.ts ./prisma/seed.ts
ENV NODE_ENV=production
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN mkdir -p /app/uploads
EXPOSE 4000
CMD ["node", "dist/index.js"]


