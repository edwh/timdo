#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_TIMDO="$ROOT_DIR/bin/timdo"

# 1. Test validation output when missing args
usage_output=$(TIMDO_SECRET=test-secret "$BIN_TIMDO" merge 2>&1 || true)
if ! echo "$usage_output" | grep -q "Usage: timdo merge"; then
  echo "FAIL: Expected usage message from timdo merge with no arguments" >&2
  exit 1
fi
echo "CLI merge usage verification passed."

# 2. Test merge operation against mock server
MOCK_PORT=9877
MOCK_PID=""
MOCK_DIR=$(mktemp -d)

cleanup() {
  if [[ -n "$MOCK_PID" ]]; then
    kill "$MOCK_PID" 2>/dev/null || true
  fi
  rm -rf "$MOCK_DIR"
}
trap cleanup EXIT

cat << 'PYEOF' > "$MOCK_DIR/server.py"
import http.server
import json
import urllib.parse
import sys

PROJECTS = [
    {
        "id": "11111111-aaaa-bbbb-cccc-111111111111",
        "userId": "user-1",
        "project": "Source Task to be merged",
        "reason": "Old duplicate",
        "status": "do",
        "priority": 4,
        "size": "**",
        "notes": "Source notes",
        "isDeleted": False,
        "createdAt": "2026-08-30T10:00:00Z",
        "updatedAt": "2026-08-30T10:00:00Z"
    },
    {
        "id": "22222222-aaaa-bbbb-cccc-222222222222",
        "userId": "user-1",
        "project": "Target Task surviving",
        "reason": "Canonical task",
        "status": "do",
        "priority": 8,
        "size": "***",
        "notes": "Target notes",
        "isDeleted": False,
        "createdAt": "2026-08-30T10:00:00Z",
        "updatedAt": "2026-08-30T10:00:00Z"
    }
]

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/v2/projects":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(PROJECTS).encode("utf-8"))
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}

        if parsed.path.startswith("/api/v2/projects/") and parsed.path.endswith("/merge"):
            target_id = parsed.path.split("/")[4]
            source_id = body.get("sourceId")

            merged = dict(PROJECTS[1])
            merged["notes"] = "Merged target notes"
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(merged).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

server = http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler)
server.serve_forever()
PYEOF

python3 "$MOCK_DIR/server.py" "$MOCK_PORT" &
MOCK_PID=$!
sleep 0.5

export TIMDO_API="http://127.0.0.1:$MOCK_PORT/api/v2"
export TIMDO_SECRET="test-secret"
export TIMDO_FORMAT="text"

# Test merging with short prefixes and --yes
MERGE_OUTPUT=$("$BIN_TIMDO" merge 1111 2222 --yes)
echo "$MERGE_OUTPUT"
if ! echo "$MERGE_OUTPUT" | grep -q "Successfully merged 'Source Task to be merged' into 'Target Task surviving'"; then
  echo "FAIL: Expected success message from timdo merge" >&2
  exit 1
fi

# Test json output
MERGE_JSON=$(TIMDO_FORMAT=json "$BIN_TIMDO" merge 1111 2222 --yes)
if ! echo "$MERGE_JSON" | grep -q "Target Task surviving"; then
  echo "FAIL: Expected json output with target task name" >&2
  exit 1
fi

# Test merging into self fails
SELF_MERGE_STATUS=0
"$BIN_TIMDO" merge 1111 1111 --yes 2>&1 || SELF_MERGE_STATUS=$?
if [[ "$SELF_MERGE_STATUS" -eq 0 ]]; then
  echo "FAIL: Merging a task into itself should fail" >&2
  exit 1
fi

echo "All CLI merge tests passed successfully."
