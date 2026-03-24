FROM node:20-bullseye AS base

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update -y && apt-get install -y openssl ca-certificates

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY shop/package.json shop/package-lock.json* ./
RUN npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY shop/. .

# Build-time env vars needed by Next.js page data collection
ARG STRIPE_SECRET_KEY
ARG STRIPE_PUBLISHABLE_KEY
ARG STRIPE_WEBHOOK_SECRET
ENV STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
ENV STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
ENV STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}

# Generating Prisma client
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
