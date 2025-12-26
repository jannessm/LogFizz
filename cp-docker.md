## Build

### Prerequisites

You'll need to prepare your secrets:

- `~/.config/github-copilot/app.json`: Your GitHub Copilot configuration
- A GitHub personal access token for git operations

### Build with secrets

might need to copy 'copilot-cli' token from the mac keychain. Then

```
docker build -t copilot-node \
  --build-arg BRANCH="fix-tests" \
  --build-arg GH_USER= \
  --build-arg GH_T= \
  --secret id=ssh_key,src=$HOME/.ssh/id_rsa \
  .
```

## Run

```bash
docker run -it copilot-node
```

### Notes

- The build secrets are only available during the build process and are not stored in the final image
- Make sure your git token file is removed after build
- The Git token is configured to use HTTPS credential helper
- The Copilot config is copied from your local machine's configuration
