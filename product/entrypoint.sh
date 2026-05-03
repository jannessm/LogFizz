#!/bin/sh
# Generate config.js from environment variables at container start.
# Set APP_URL to the full URL of the LogFizz web application.
# Example: APP_URL=https://app.logfizz.example.com
#
# If APP_URL is empty, the app launch button on app.html will be
# visually disabled with an explanatory message until it is configured.
#
# Set GITHUB_URL to the GitHub repository URL.
# Example: GITHUB_URL=https://github.com/yourname/yourrepo
# Defaults to the public LogFizz repository.

APP_URL="${APP_URL:-}"
GITHUB_URL="${GITHUB_URL:-https://github.com/jannessm/LogFizz}"

cat > /usr/share/nginx/html/assets/config.js <<EOF
/* Auto-generated at container start. Do not edit manually. */
window.LOGFIZZ_APP_URL = "${APP_URL}";
window.LOGFIZZ_GITHUB_URL = "${GITHUB_URL}";
EOF

# Replace APP_URL placeholders in all HTML files.
# The more specific pattern (APP_URL?register=true) must come before the plain (APP_URL).
HTML_DIR=/usr/share/nginx/html
if [ -n "${APP_URL}" ]; then
  find "${HTML_DIR}" -name "*.html" | while read -r f; do
    sed -i \
      -e "s|APP_URL?register=true|${APP_URL}/login?register=true|g" \
      -e "s|APP_URL|${APP_URL}/login|g" \
      "$f"
  done
fi

# Replace GITHUB_URL placeholders in all HTML files.
if [ -n "${GITHUB_URL}" ]; then
  find "${HTML_DIR}" -name "*.html" | while read -r f; do
    sed -i "s|GITHUB_URL|${GITHUB_URL}|g" "$f"
  done
fi

exec "$@"
