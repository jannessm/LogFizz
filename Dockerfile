FROM node:latest

ARG BRANCH
ARG GH_USER
ARG GH_T

# Install dependencies
RUN apt update && apt upgrade -y && apt install -y \
  git \
  postgresql \
  curl ca-certificates jq gnupg lsb-release wget unzip \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @github/copilot

RUN --mount=type=secret,id=ssh_key,uid=1000 \
  mkdir -p .ssh && \
  cp /run/secrets/ssh_key .ssh/id_rsa && \
  chmod 777 .ssh/id_rsa && \
  ssh-keyscan github.com >> .ssh/known_hosts 2>/dev/null

# Create non-root user
RUN useradd -m -s /bin/bash copilot
USER copilot
WORKDIR /home/copilot
RUN mkdir .copilot

# Configure Copilot with config from build secret
COPY --chown=copilot:copilot .cp/config.json .copilot/config.json
RUN if [ -n "$GH_T" ] && [ -n "$GH_USER" ]; then \
    jq --arg user "$GH_USER" --arg token "$GH_T" \
      '.last_logged_in_user.login = $user | .logged_in_users[0].login = $user | .copilot_tokens["https://github.com:" + $user] = $token' \
      .copilot/config.json > .copilot/config.json.tmp && \
    mv .copilot/config.json.tmp .copilot/config.json; \
  fi
WORKDIR /home/copilot
ENV PATH="/home/copilot/.local/bin:${PATH}"

COPY --chown=copilot:copilot . .
RUN rm -rf **/node_modules
RUN cd backend && npm ci && cd ../frontend && npm ci && cd ../lib && npm ci && cd ..

RUN git config --global user.email "copilot@github.com"
RUN git config --global user.name "GitHub Copilot"
RUN git commit -am "starting copilot" || echo "No changes to commit"
RUN git checkout ${BRANCH} || git checkout -b ${BRANCH}
RUN git push -u origin ${BRANCH} || echo "Could not push branch"

CMD ["copilot", "--allow-all-tools"]
