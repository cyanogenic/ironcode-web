#!/usr/bin/env bash
set -Eeuo pipefail

: "${CUSTOMER_HOST:=_}"
: "${STAFF_HOST:=staff.example.com}"

if (( $# > 0 )); then
  exec "$@"
fi

envsubst '${CUSTOMER_HOST} ${STAFF_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

node /opt/ironcode/apps/api/dist/main.js &
api_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

shutdown() {
  kill -TERM "$api_pid" "$nginx_pid" 2>/dev/null || true
  wait "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap shutdown TERM INT

wait -n "$api_pid" "$nginx_pid"
status=$?
shutdown
exit "$status"
