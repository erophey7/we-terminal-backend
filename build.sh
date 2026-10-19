#!/bin/sh
# Builds standalone binaries (frontend embedded via go:embed) for all platforms.
set -e
cd "$(dirname "$0")"
./sync-frontend.sh
mkdir -p dist
export CGO_ENABLED=0

build() {
  os=$1; arch=$2; ext=$3
  echo "building $os/$arch..."
  GOOS=$os GOARCH=$arch go build -trimpath -ldflags="-s -w" \
    -o "dist/webterm-$os-$arch$ext" ./cmd/webterm
}

build windows amd64 .exe
build windows arm64 .exe
build linux amd64 ""
build linux arm64 ""
build darwin amd64 ""
build darwin arm64 ""

echo "done, see backend/dist/"
