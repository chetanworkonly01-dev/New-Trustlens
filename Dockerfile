# ============================================
# KPMG TrustLens — Production Dockerfile
# Platform: Railway (Docker-based deploy)
# ============================================

# ── Stage 1: Build ──
FROM node:20-slim AS builder

# Install system dependencies required by Playwright Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (Docker layer caching)
COPY package.json package-lock.json ./

# Install NPM dependencies
RUN npm ci

# Set Playwright browser path BEFORE installing so it installs to /ms-playwright
# This must match the PLAYWRIGHT_BROWSERS_PATH env var set in Railway
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install Playwright Chromium + system deps into /ms-playwright
RUN npx playwright install --with-deps chromium

# Copy source code
COPY . .

# Build Next.js (standalone mode)
RUN npm run build

# --- Production setup ---
# The standalone build outputs to .next/standalone
# We need to copy the public and static files into it
RUN cp -r public .next/standalone/public 2>/dev/null || true
RUN cp -r .next/static .next/standalone/.next/static

# Ensure the audit data directory exists for the volume mount
RUN mkdir -p .next/standalone/.audit-data

# ── Runtime Configuration ──
# Railway sets PORT dynamically, Next.js standalone server reads it
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Expose the port
EXPOSE 3000

# Health check — Railway uses this to verify container is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Run the standalone server (much lighter than `next start`)
CMD ["node", ".next/standalone/server.js"]
