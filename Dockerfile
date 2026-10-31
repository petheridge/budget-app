# Build the frontend
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# PocketBase serves the API and the built frontend. Keep PB_VERSION in step with pocketbase/install.sh.
FROM alpine:3.22
ARG PB_VERSION=0.40.6
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates \
  && ZIP="pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
  && BASE="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}" \
  && cd /tmp \
  && wget -q "$BASE/$ZIP" \
  && wget -q "$BASE/checksums.txt" \
  && grep " $ZIP\$" checksums.txt | sha256sum -c - \
  && mkdir -p /pb \
  && unzip -q "$ZIP" pocketbase -d /pb \
  && rm -f /tmp/*
COPY pocketbase/pb_migrations /pb/pb_migrations
COPY --from=web /web/dist /pb/pb_public
EXPOSE 8090
# serve applies pb_migrations on startup. Automigrate is off so that admin UI changes can't write
# migration files into the container: schema changes only come from git. Mount a volume at /pb/pb_data.
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--publicDir=/pb/pb_public", "--migrationsDir=/pb/pb_migrations", "--automigrate=false"]
