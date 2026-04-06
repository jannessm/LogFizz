FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY nginx.conf /etc/nginx/conf.d/product.conf

# Copy the static site
COPY . /usr/share/nginx/html/

# Make entrypoint executable
RUN chmod +x /usr/share/nginx/html/entrypoint.sh

EXPOSE 80

# entrypoint.sh writes config.js from APP_URL env var, then starts nginx
ENTRYPOINT ["/usr/share/nginx/html/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
