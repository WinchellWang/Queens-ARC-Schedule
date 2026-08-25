FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the files required by the static site. Building them into the
# image avoids Windows/NAS bind-mount permission issues that can cause 403s.
COPY index.html about.html README.md manifest.json robots.txt sitemap.xml gym.ics web_logo.jpg /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

RUN chmod -R a+rX /usr/share/nginx/html \
    && nginx -t

EXPOSE 80

