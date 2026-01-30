FROM base AS deps
WORKDIR /app
ENV HUSKY=0
ENV CI=true

COPY package.json package-lock.json ./

# show npm config + git config
RUN npm -v && git --version
RUN npm config list

# IMPORTANT: print full error output
RUN npm ci --foreground-scripts --loglevel verbose
