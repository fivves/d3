# Build stage
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat tzdata
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
COPY prisma/seed.js ./prisma/seed.js
ENV NODE_ENV=production
ENV TZ=America/Los_Angeles
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npx tsc -p tsconfig.build.json

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Los_Angeles
RUN apk add --no-cache openssl libc6-compat tzdata \
  && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
  && echo $TZ > /etc/timezone
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN mkdir -p /app/uploads
EXPOSE 4000
CMD ["node", "dist/index.js"]


