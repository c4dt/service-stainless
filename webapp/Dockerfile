FROM node:14-alpine AS builder

WORKDIR /webapp

COPY package*.json .
RUN npm ci

COPY . .
RUN npx ng build --prod

FROM python:3

COPY --from=builder /webapp/dist /webapp
COPY src/assets /webapp/assets

CMD python3 -m http.server 8080 --directory /webapp
