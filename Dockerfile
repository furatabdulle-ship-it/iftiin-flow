FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG SITE_URL=https://iftiin-flow.com
ENV SITE_URL=$SITE_URL
RUN npm run build
RUN chown -R node:node /app
USER node
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["sh", "-c", "npm run db:migrate && exec node ./dist/server/entry.mjs"]
