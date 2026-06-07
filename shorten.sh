#!/usr/bin/env bash
# 建立 devbox 短網址。用法:./shorten.sh <url>
# token 從 api/.dev.vars 讀,不寫死在腳本。
set -euo pipefail

API="https://devbox-api.chinte-cheng.workers.dev"
VARS="$(dirname "$0")/api/.dev.vars"

url="${1:-}"
if [ -z "$url" ]; then
  echo "用法: $0 <要縮短的網址>" >&2
  exit 1
fi
if [ ! -f "$VARS" ]; then
  echo "找不到 $VARS(CREATE_TOKEN)" >&2
  exit 1
fi
# 讀 token:取首行、去掉 CR 與包覆引號;抓不到就明確報錯(別靜默送空 token)
token="$(grep '^CREATE_TOKEN=' "$VARS" | head -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//')" || true
if [ -z "$token" ]; then
  echo "找不到 CREATE_TOKEN= 於 $VARS" >&2
  exit 1
fi

# 用 python 安全地把 url 包成 JSON,避免特殊字元出問題
body="$(URL="$url" python3 -c 'import json,os;print(json.dumps({"url":os.environ["URL"]}))')"

# -sS:安靜但保留硬錯誤訊息;-w 取回 HTTP 狀態碼
resp="$(curl -sS -w '\n%{http_code}' -X POST "$API/api/links" \
  -H "authorization: Bearer $token" \
  -H "content-type: application/json" \
  --data "$body")"
http_code="${resp##*$'\n'}"
resp="${resp%$'\n'*}"
if [ "$http_code" = "401" ]; then
  echo "401:token 無效或過期" >&2
  exit 1
fi

# 解析回應,印出短網址(或錯誤)
RESP="$resp" python3 -c '
import json, os, sys
raw = os.environ["RESP"]
try:
    d = json.loads(raw)
except Exception:
    sys.exit("error: " + raw)
url = d.get("shortUrl")
if url:
    print(url)
else:
    sys.exit("error: " + raw)
'
