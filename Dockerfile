# Stage 1: build Angular
FROM node:24-trixie-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: runtime with Azure CLI
FROM node:24-trixie-slim AS runtime

# Microsoft recommends the bookworm repository when a newer Debian release
# does not yet have an Azure CLI repository.
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -sLS --proto '=https' --tlsv1.2 https://packages.microsoft.com/keys/microsoft.asc | \
      gpg --dearmor > /etc/apt/keyrings/microsoft.gpg && \
    chmod go+r /etc/apt/keyrings/microsoft.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/microsoft.gpg] \
https://packages.microsoft.com/repos/azure-cli/ bookworm main" \
      > /etc/apt/sources.list.d/azure-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends azure-cli && \
    apt-get purge -y --auto-remove curl gnupg && \
    rm -rf /var/lib/apt/lists/*

# Patch vulnerable libraries bundled by Azure CLI, including the compatible
# pyOpenSSL release required by cryptography 50. Core CLI commands used by the
# app do not need pip or its vendored build dependencies at runtime.
RUN /opt/az/bin/python3 -m pip install --no-cache-dir --only-binary=:all: --upgrade \
      cryptography==50.0.2 pyOpenSSL==26.4.0 oauthlib==4.0.1 urllib3==2.8.0 pip==26.3 && \
    /opt/az/bin/python3 -m pip check && \
    rm -rf /opt/az/lib/python*/site-packages/pip /opt/az/lib/python*/site-packages/pip-*.dist-info \
      /opt/az/lib/python*/ensurepip /opt/az/bin/pip*

RUN mkdir -p /home/zuremap/.azure && chown -R node:node /home/zuremap

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    rm -rf /root/.npm /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx /opt/yarn* && \
    find /usr/bin /usr/sbin -type f -perm /6000 -exec chmod a-s {} +

COPY proxy/ ./proxy/
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV AZURE_CONFIG_DIR=/home/zuremap/.azure

USER node

EXPOSE 3001

CMD ["node", "proxy/server.js"]
