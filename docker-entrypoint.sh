#!/bin/sh
set -e
node /app/proxy-server.mjs &
exec nginx -g "daemon off;"
