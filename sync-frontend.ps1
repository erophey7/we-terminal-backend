# Refreshes internal\webassets\web from the sibling ..\frontend directory, if present.
# Without it nothing happens: the repository ships a ready copy, so the build works as is.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path "..\frontend")) {
  Write-Host "..\frontend not found - using the committed internal\webassets\web"
  exit 0
}
$dest = "internal\webassets\web"
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item ..\frontend\index.html, ..\frontend\style.css -Destination $dest
Copy-Item ..\frontend\*.js -Destination $dest
Copy-Item ..\frontend\vendor -Destination $dest -Recurse
Write-Host "synced ..\frontend -> $dest"
