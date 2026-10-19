# Builds standalone binaries (frontend embedded via go:embed) for all platforms.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& .\sync-frontend.ps1
New-Item -ItemType Directory -Force -Path dist | Out-Null
$env:CGO_ENABLED = "0"

function Build($os, $arch, $ext) {
  Write-Host "building $os/$arch..."
  $env:GOOS = $os
  $env:GOARCH = $arch
  go build -trimpath -ldflags="-s -w" -o "dist/webterm-$os-$arch$ext" ./cmd/webterm
}

Build windows amd64 ".exe"
Build windows arm64 ".exe"
Build linux amd64 ""
Build linux arm64 ""
Build darwin amd64 ""
Build darwin arm64 ""

Write-Host "done, see backend/dist/"
