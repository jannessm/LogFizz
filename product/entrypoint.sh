#!/bin/sh
# Generate config.js from environment variables at container start.
# Set APP_URL to the full URL of the TapShift web application.
# Example: APP_URL=https://app.tapshift.example.com

APP_URL="${APP_URL:-}"

cat > /usr/share/nginx/html/assets/config.js <<EOF
/* Auto-generated at container start. Do not edit manually. */
window.TAPSHIFT_APP_URL = "${APP_URL}";
EOF

exec "$@"
