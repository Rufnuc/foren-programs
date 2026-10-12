# --- build stage --------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /repo
# Workspace root + app sources
COPY package.json yarn.lock* ./
COPY app/package.json ./app/
RUN corepack enable && yarn install --frozen-lockfile --ignore-scripts || npm install --prefix app
COPY app ./app
WORKDIR /repo/app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime stage ------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /repo/app/.next ./.next
COPY --from=build /repo/app/public ./public
COPY --from=build /repo/app/node_modules ./node_modules
COPY --from=build /repo/app/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
