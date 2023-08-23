FROM node:14-alpine AS builder

WORKDIR /webapp

COPY package*.json .
RUN npm ci

COPY . .
RUN npx ng build --prod

FROM joseluisq/static-web-server:2 AS runner

COPY --from=builder /webapp/dist /webapp

WORKDIR /webapp
ENV SERVER_ROOT=/webapp
