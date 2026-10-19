# Windows installer: registers the native messaging host and builds dist/ai-reply.xpi.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$hostDir = Join-Path $root 'host'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 18+ is required (node not found on PATH).' }
if (-not (Test-Path "$hostDir\config.json")) { Copy-Item "$hostDir\config.example.json" "$hostDir\config.json"; Write-Host 'Created host\config.json, edit it to set your style file and context.' }

$manifest = @{
  name = 'ai_reply_host'
  description = 'AI reply native host (claude -p)'
  path = (Join-Path $hostDir 'host.bat')
  type = 'stdio'
  allowed_extensions = @('ai-reply@korent.dev')
} | ConvertTo-Json
$manifestPath = Join-Path $hostDir 'ai_reply_host.json'
[IO.File]::WriteAllText($manifestPath, $manifest)
New-Item -Path 'HKCU:\Software\Mozilla\NativeMessagingHosts\ai_reply_host' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Mozilla\NativeMessagingHosts\ai_reply_host' -Name '(default)' -Value $manifestPath

New-Item -ItemType Directory -Force (Join-Path $root 'dist') | Out-Null
$xpi = Join-Path $root 'dist\ai-reply.xpi'
$zip = "$xpi.zip"
Remove-Item $xpi, $zip -ErrorAction SilentlyContinue
# ponytail: flat extension folder, so Compress-Archive's backslash bug on subfolders does not apply
Compress-Archive -Path (Join-Path $root 'extension\*') -DestinationPath $zip
Move-Item $zip $xpi

Write-Host "Host registered. Now install $xpi in Thunderbird: Add-ons and Themes, gear icon, Install Add-on From File."
