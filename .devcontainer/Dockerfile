FROM docker.io/alpine:latest

ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.local/bin:$BUN_INSTALL/bin:$PATH"

RUN apk add --no-cache curl bash gnupg libstdc++ libgcc nodejs \
	&& curl -fsSL https://bun.com/install | bash \
	&& apk add --no-cache docker-cli docker-cli-buildx docker-cli-compose \
	&& apk add --no-cache git-lfs && git lfs install

RUN curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh && compact update
