#.devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:20

ENV DENO_INSTALL=/home/node/.deno
RUN curl -fsSL https://deno.land/install.sh | sh \
  && chown -R node:node /home/node/.deno