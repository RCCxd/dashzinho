#!/bin/sh
set -eu

attempt=1
while [ "$attempt" -le 12 ]; do
  if pnpm db:migrate; then
    exec node dist/index.js
  fi
  printf 'MySQL migrations/readiness attempt %s/12 failed; retrying in 5 seconds.\n' "$attempt" >&2
  attempt=$((attempt + 1))
  sleep 5
done

printf 'MySQL migrations did not complete; refusing to start the application.\n' >&2
exit 1
