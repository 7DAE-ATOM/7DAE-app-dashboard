FROM docker-airbus-virtual.artifactory.2b82.aws.cloud.airbus.corp/nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-custom.conf /etc/nginx/templates/default.conf.template

# Change the target directory to match your subpath
COPY --chown=101:101 out /usr/share/nginx/html/atom-app-dashboard

USER 101
EXPOSE 8080
