FROM node:22-alpine AS app

ENV NODE_ENV=production PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

RUN apk update && apk upgrade

RUN mkdir -p /usr/src/app/node_modules
RUN chown -R node:node /usr/src/app

WORKDIR /usr/src/app

USER node

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

EXPOSE 3500
