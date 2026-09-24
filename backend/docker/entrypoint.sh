#!/bin/sh
set -eu
cd /var/www/html

# APP_KEY pode ser fornecida pelo ambiente; para a demonstração, gere-a em memória.
if [ -z "${APP_KEY:-}" ]; then
    APP_KEY="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')"
    export APP_KEY
fi

php docker/wait-for-db.php
php artisan migrate --force --no-interaction
php artisan db:seed --force --no-interaction
exec "$@"
