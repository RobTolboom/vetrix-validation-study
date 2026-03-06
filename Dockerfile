# Vetrix Validation Webapp — Docker image
# Uses Alpine-based Node.js for small image size (~150MB).
# Episodes and data are mounted as volumes (see docker-compose.yml).

FROM node:20-alpine
WORKDIR /app

# Copy package files first for layer caching (dependencies change less often)
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy application source
COPY server.js ./
COPY lib/ ./lib/
COPY public/ ./public/

EXPOSE 3000
CMD ["node", "server.js"]
