FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development \
    PORT=4000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
