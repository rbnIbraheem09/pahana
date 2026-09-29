#!/bin/zsh
# Dev helper: optionally run JS in the app, wait, capture the window, flatten onto a backdrop.
# usage: scripts/shot.sh <out.png> [js] [wait-seconds]
OUT=$1; JS=$2; WAIT=${3:-0.8}
if [[ -n "$JS" ]]; then curl -s -X POST --data-binary "(()=>{$JS})()" http://127.0.0.1:4299/eval >/dev/null; fi
sleep $WAIT
curl -s -o "$OUT.raw.png" http://127.0.0.1:4299/shot && node "$(dirname $0)/flatten.mjs" "$OUT.raw.png" "$OUT" && rm "$OUT.raw.png"
