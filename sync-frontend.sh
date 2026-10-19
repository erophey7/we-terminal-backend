#!/bin/sh
# Refreshes internal/webassets/web from the sibling ../frontend directory, if present.
# Without it nothing happens: the repository ships a ready copy, so the build works as is.
set -e
cd "$(dirname "$0")"
if [ ! -d ../frontend ]; then
  echo "../frontend not found - using the committed internal/webassets/web"
  exit 0
fi
rm -rf internal/webassets/web
mkdir -p internal/webassets/web
cp ../frontend/index.html ../frontend/style.css internal/webassets/web/
cp ../frontend/*.js internal/webassets/web/
cp -r ../frontend/vendor internal/webassets/web/
echo "synced ../frontend -> internal/webassets/web"
