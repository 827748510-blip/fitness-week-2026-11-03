#!/usr/bin/env bash
# Refresh synced.json from live sources; mirror to gist; update data/latest.json only when payload changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/synced.json"
DATA="$ROOT/data/latest.json"
GIST_ID=9d14b42b506ba1fc2635ad2538add3f5
TMP=$(mktemp)
SRC=""
ok=0
for url in \
  "https://j.jstash.app/9UOvxv7LGyOynCF0eRzE5Q" \
  "https://gist.githubusercontent.com/827748510-blip/${GIST_ID}/raw/latest.json" \
  "https://raw.githubusercontent.com/827748510-blip/fitness-week-2026-11-03/main/data/latest.json"
 do
  if curl -fsSL --max-time 20 "$url" -o "$TMP"; then
    SRC="$url"
    ok=1
    break
  fi
 done
if [[ $ok -ne 1 ]]; then
  echo "all sources failed" >&2
  rm -f "$TMP"
  exit 1
fi
python3 - "$TMP" "$OUT" "$DATA" <<'PY'
import json, sys, os, hashlib
from datetime import datetime, timezone
src, out, data = sys.argv[1], sys.argv[2], sys.argv[3]
obj = json.load(open(src))
if "state" not in obj and "days" in obj:
  obj = {"key":"fitness-week-2026-11-03","state": obj}
obj["key"] = obj.get("key") or "fitness-week-2026-11-03"
obj["week"] = "2026-11-03 to 2026-11-09"
# Stable payload for repo/gist (drop mirror stamp)
stable = {k:v for k,v in obj.items() if k != "mirrored_at"}
stable_text = json.dumps(stable, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
local = dict(stable)
local["mirrored_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
local_text = json.dumps(local, ensure_ascii=False, indent=2) + "\n"
open(out,"w").write(local_text)
os.makedirs(os.path.dirname(data), exist_ok=True)
prev = open(data).read() if os.path.exists(data) else ""
# Compare ignoring mirrored_at / key order by hashing canonical stable
def canon(t):
  try:
    o=json.loads(t)
    o.pop("mirrored_at", None)
    return json.dumps(o, ensure_ascii=False, sort_keys=True)
  except Exception:
    return t
changed = canon(prev) != canon(stable_text)
if changed:
  open(data,"w").write(stable_text)
print("changed" if changed else "unchanged")
open("/tmp/fitness-sync-changed","w").write("1" if changed else "0")
open("/tmp/fitness-stable.json","w").write(stable_text)
PY
rm -f "$TMP"
echo "pulled from $SRC"

# Update gist with stable payload
PATCH=$(mktemp)
python3 - <<PY
import json
text=open("/tmp/fitness-stable.json").read()
json.dump({"files":{"latest.json":{"content":text}}}, open("$PATCH","w"))
PY
gh api -X PATCH "gists/${GIST_ID}" --input "$PATCH" >/dev/null
rm -f "$PATCH"
echo "gist updated"

changed=$(cat /tmp/fitness-sync-changed)
if [[ "$changed" == "1" ]]; then
  cd "$ROOT"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git add data/latest.json
    if ! git diff --cached --quiet -- data/latest.json; then
      git -c user.email='fitness-sync@users.noreply.github.com' -c user.name='Fitness Sync' \
        commit -m "chore: mirror PWA progress" -- data/latest.json
      git push origin HEAD || true
      echo "repo data/latest.json pushed"
    fi
  fi
else
  echo "repo data unchanged"
fi
