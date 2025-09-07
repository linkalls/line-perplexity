### Production Dockerfile for Bun app
FROM oven/bun:latest

# Create app directory
WORKDIR /app

# Copy package manifest and lock first for better caching
COPY package.json bun.lock /app/

# Install deps
RUN bun install --production

# Copy source
COPY . /app/

# Build step (if you have a build step, otherwise Bun runs TS directly)
# If you prefer to compile, you can add a build script in package.json

EXPOSE 3000

# Use non-root user if desired (oven/bun image has bun user)
USER bun

# Run the server
CMD ["bun", "run", "src/index.ts"]
