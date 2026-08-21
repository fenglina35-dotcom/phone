FROM node:20-bookworm-slim

WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DISPLAY=:99 \
    PHONE_DELIVERY_BROWSER_HOST=0.0.0.0 \
    PHONE_DELIVERY_PROFILE=/data/profile

RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify fonts-wqy-microhei ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm

COPY src ./src
COPY entrypoint.sh ./entrypoint.sh
RUN chmod 0755 /app/entrypoint.sh

VOLUME ["/data/profile"]
EXPOSE 8787 6080
ENTRYPOINT ["/app/entrypoint.sh"]
