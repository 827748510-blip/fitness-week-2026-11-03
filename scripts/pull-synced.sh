#!/usr/bin/env bash
# Refresh synced.json from live sources; mirror to gist + repo data/latest.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/synced.json"
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
python3 - "$TMP" "$OUT" "$ROOT/data/latest.json" <<'PY'
import json, sys
from datetime import datetime, timezone
src, out, data = sys.argv[1], sys.argv[2], sys.argv[3]
obj = json.load(open(src))
if "state" not in obj and "days" in obj:
  obj = {"key":"fitness-week-2026-11-03","state": obj}
obj["key"] = obj.get("key") or "fitness-week-2026-11-03"
obj["week"] = "2026-11-03 to 2026-11-09"
obj.setdefault("updated_at", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
obj["mirrored_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
text = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
open(out,"w").write(text)
import os
os.makedirs(os.path.dirname(data), exist_ok=True)
open(data,"w").write(text)
print("wrote", out)
PY
rm -f "$TMP"
echo "pulled from $SRC"

# Update gist
PATCH=$(mktemp)
python3 - "$OUT" "$PATCH" <<'PY'
import json,sys
text=open(sys.argv[1]).read()
json.dump({"files":{"latest.json":{"content":text}}}, open(sys.argv[2],"w"))
PY
gh api -X PATCH "gists/${GIST_ID}" --input "$PATCH" >/dev/null
rm -f "$PATCH"
echo "gist updated"

# Commit data/latest.json if in git repo and changed
cd "$ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add data/latest.json synced.json 2>/dev/null || true
  if ! git diff --cached --quiet -- data/latest.json 2>/dev/null; then
    git -c user.email='fitness-sync@users.noreply.github.com' -c user.name='Fitness Sync' \
      commit -m "chore: mirror PWA progress" -- data/latest.json >/dev/null || true
    git push origin HEAD >/dev/null 2>&1 || true
    echo "repo data/latest.json pushed"
  else
    echo "repo data unchanged"
  fi
fi
