#!/bin/sh
# macOS / Linux installer: registers the native messaging host and builds dist/ai-reply.xpi.
set -e
root=$(cd "$(dirname "$0")" && pwd)
command -v node >/dev/null || { echo "Node.js 18+ is required (node not found on PATH)."; exit 1; }
[ -f "$root/host/config.json" ] || { cp "$root/host/config.example.json" "$root/host/config.json"; echo "Created host/config.json, edit it to set your style file and context."; }
chmod +x "$root/host/host.cjs"

case "$(uname)" in
  Darwin) dir="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts" ;;
  *) dir="$HOME/.mozilla/native-messaging-hosts" ;;
esac
mkdir -p "$dir"
cat > "$dir/ai_reply_host.json" <<JSON
{
  "name": "ai_reply_host",
  "description": "AI reply native host (claude -p)",
  "path": "$root/host/host.cjs",
  "type": "stdio",
  "allowed_extensions": ["ai-reply@korent.dev"]
}
JSON

mkdir -p "$root/dist"
rm -f "$root/dist/ai-reply.xpi"
(cd "$root/extension" && zip -qr "$root/dist/ai-reply.xpi" .)
echo "Host registered in $dir. Now install dist/ai-reply.xpi in Thunderbird: Add-ons and Themes, gear icon, Install Add-on From File."
