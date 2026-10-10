# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cached unless package*.json changes)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Build args — CRA bakes REACT_APP_* into the static bundle at build time
ARG REACT_APP_API_URL
ARG REACT_APP_API_BASE
ARG REACT_APP_API_INFERENCE_BASE
ARG REACT_APP_API_IMAGE_ENHANCEMENT_BASE
ARG REACT_APP_API_IMAGE_TRANSLATION_BASE
ARG REACT_APP_OPENAI_API_KEY
ARG REACT_APP_POSTHOG_KEY
ARG REACT_APP_POSTHOG_HOST

ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_API_BASE=$REACT_APP_API_BASE \
    REACT_APP_API_INFERENCE_BASE=$REACT_APP_API_INFERENCE_BASE \
    REACT_APP_API_IMAGE_ENHANCEMENT_BASE=$REACT_APP_API_IMAGE_ENHANCEMENT_BASE \
    REACT_APP_API_IMAGE_TRANSLATION_BASE=$REACT_APP_API_IMAGE_TRANSLATION_BASE \
    REACT_APP_OPENAI_API_KEY=$REACT_APP_OPENAI_API_KEY \
    REACT_APP_POSTHOG_KEY=$REACT_APP_POSTHOG_KEY \
    REACT_APP_POSTHOG_HOST=$REACT_APP_POSTHOG_HOST

COPY . .
RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Custom nginx config — handles SPA routing (all paths → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
