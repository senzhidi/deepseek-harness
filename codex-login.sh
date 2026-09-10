#!/bin/zsh
# codex-login.sh —— DSH 的 Codex 凭证登录/修复工具
#
# 背景:DSH v0.1.1-rc.2 注册了 OAuth 登录流程但没有实现界面,本脚本补位。
# 凭证写入 ~/.dsh/.credentials.yaml 的 records 段(llm-pi-ai/openai-codex),
# 之后过期由 pi-ai 自动刷新,无需再跑本脚本。
#
# 用法:
#   ./codex-login.sh repair        # 静默修复:用现有 refresh_token 换新(首选,零交互)
#   ./codex-login.sh login         # 设备码登录:refresh_token 彻底失效时用,浏览器输码
#   ./codex-login.sh import 文件   # 导入 CPA 下载的 Codex JSON(不会改 ~/.codex/auth.json)
#
# 代理端口非 7899 时:DSH_PROXY_PORT=端口 ./codex-login.sh repair
# 测试/高级用法:DSH_CREDENTIALS_FILE=文件 可改写目标凭证库。

set -u
PROXY_PORT="${DSH_PROXY_PORT:-7899}"
export HTTPS_PROXY="http://127.0.0.1:$PROXY_PORT"
export HTTP_PROXY="http://127.0.0.1:$PROXY_PORT"
export NO_PROXY="127.0.0.1,localhost"
REPO="$HOME/workspace/deepseek-harness"
CRED="${DSH_CREDENTIALS_FILE:-$HOME/.dsh/.credentials.yaml}"
CLIENT_ID="app_EMoamEEZ73f0CkXaXp7hrann"

record_upsert() { # $1=access $2=refresh $3=expires_ms
  python3 - "$1" "$2" "$3" "$CRED" << 'PYEOF'
import re, sys, shutil, time
access, refresh, expires_ms, path = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
shutil.copy(path, path + '.bak')
text = open(path).read()
block = (
    '    kind: grant\n'
    '    payload:\n'
    '      type: oauth\n'
    f'      access: "{access}"\n'
    f'      refresh: "{refresh}"\n'
    f'      expires: {expires_ms}\n'
)
if re.search(r'^  llm-pi-ai/openai-codex:', text, re.M):
    # 原地替换整个记录块(键行 + 旧三元组 → 键行 + 新三元组)
    pat = re.compile(
        r'  llm-pi-ai/openai-codex:\n'
        r'    kind: grant\n'
        r'    payload:\n'
        r'      type: oauth\n'
        r'      access: "?[^"\n]*"?\n'
        r'      refresh: "?[^"\n]*"?\n'
        r'      expires: \d+\n')
    if not pat.search(text):
        sys.exit('❌ 记录块格式与预期不符,请手工检查 ' + path)
    replacement = '  llm-pi-ai/openai-codex:\n' + block
    text = pat.sub(lambda m: replacement, text, count=1)
elif re.search(r'^records:', text, re.M):
    text = text.replace('records:\n', 'records:\n  llm-pi-ai/openai-codex:\n' + block, 1)
else:
    if text and not text.endswith('\n'):
        text += '\n'
    text += 'records:\n  llm-pi-ai/openai-codex:\n' + block
open(path, 'w').write(text)
print('✅ 凭证已写入(备份 .bak),access 有效期至 '
      + time.strftime('%Y-%m-%d %H:%M', time.localtime(int(expires_ms) / 1000)))
PYEOF
}

case "${1:-}" in
import)
  INPUT="${2:-}"
  [ -n "$INPUT" ] || { echo "❌ 用法: $0 import /path/to/codex-account.json"; exit 1; }
  [ -f "$INPUT" ] || { echo "❌ 找不到 CPA 凭证文件: $INPUT"; exit 1; }
  PERMS=$(stat -f '%Lp' "$INPUT" 2>/dev/null || echo unknown)
  if [ "$PERMS" != "unknown" ] && [ $((8#$PERMS & 8#077)) -ne 0 ]; then
    echo "⚠️  凭证文件权限是 $PERMS；建议导入后执行: chmod 600 '$INPUT'"
  fi
  VALUES=$(python3 - "$INPUT" << 'PYEOF'
import base64, datetime, json, sys

path = sys.argv[1]
try:
    data = json.load(open(path))
except (OSError, json.JSONDecodeError) as error:
    sys.exit(f'❌ 无法读取 CPA JSON: {error}')
if data.get('type') != 'codex':
    sys.exit('❌ 这不是 CPA Codex 凭证(type 必须是 codex)')
if data.get('disabled') is True:
    sys.exit('❌ CPA 已将这条凭证标记为 disabled；拒绝导入')
access = data.get('access_token')
refresh = data.get('refresh_token')
if not isinstance(access, str) or not access or not isinstance(refresh, str) or not refresh:
    sys.exit('❌ CPA JSON 缺少非空 access_token/refresh_token')
expires = None
raw_expired = data.get('expired')
if isinstance(raw_expired, str):
    try:
        expires = int(datetime.datetime.fromisoformat(raw_expired.replace('Z', '+00:00')).timestamp() * 1000)
    except ValueError:
        pass
if expires is None:
    try:
        payload = access.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        expires = int(claims['exp']) * 1000
    except (IndexError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        sys.exit('❌ CPA JSON 的 expired 与 access_token exp 都无法解析')
print(access, refresh, expires)
PYEOF
  ) || exit 1
  read -r A R E <<< "$VALUES"
  record_upsert "$A" "$R" "$E"
  echo "✅ 已从 CPA 格式转换为 DSH 的 llm-pi-ai/openai-codex grant"
  echo "ℹ️  没有改动 ~/.codex/auth.json；运行 ~/workspace/deepseek-harness/start-dsh.sh 重启后生效"
  ;;

repair)
  RT=$(python3 - "$CRED" << 'PYEOF'
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r'llm-pi-ai/openai-codex:.*?refresh: "([^"]+)"', text, re.S)
if not m:
    sys.exit(1)
print(m.group(1))
PYEOF
  ) || { echo "❌ 凭证库里没有可刷新的记录,请改用: $0 login"; exit 1; }
  RESP=$(mktemp)
  CODE=$(curl -s -m 20 -o "$RESP" -w "%{http_code}" -X POST https://auth.openai.com/oauth/token \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=refresh_token" \
    --data-urlencode "client_id=$CLIENT_ID" \
    --data-urlencode "refresh_token=$RT")
  if [ "$CODE" != "200" ]; then
    echo "❌ 静默刷新失败(HTTP $CODE)——refresh_token 可能已被吊销,请改用: $0 login"
    rm -f "$RESP"
    exit 1
  fi
  read -r A R E <<< "$(python3 -c "
import json, time
d = json.load(open('$RESP'))
print(d['access_token'], d['refresh_token'], int(time.time() * 1000) + d['expires_in'] * 1000)")"
  rm -f "$RESP"
  record_upsert "$A" "$R" "$E"
  echo "ℹ️  运行 ~/workspace/deepseek-harness/start-dsh.sh 重启后生效"
  ;;

login)
  TARGET=$(find "$REPO/node_modules/.pnpm" -maxdepth 1 -name '@earendil-works+pi-ai*' -type d 2>/dev/null | head -1)
  [ -z "$TARGET" ] && { echo "❌ 未找到 pi-ai,请先在 $REPO 下完成依赖安装"; exit 1; }
  export PI_TARGET="$TARGET/node_modules/@earendil-works/pi-ai/dist/auth/oauth/openai-codex.js"
  OUT=$(mktemp)
  (cd "$REPO/packages/llm/llm-pi-ai" && PI_TARGET="$PI_TARGET" node --input-type=module -e '
const mod = await import("file://" + process.env.PI_TARGET)
const cred = await mod.openaiCodexOAuth.login({
  prompt: async (p) => {
    if (p.type === "select") return "device_code"
    throw new Error("unexpected prompt: " + p.type)
  },
  notify: (e) => {
    if (e.type === "device_code") {
      console.log("DEVICE_URL=" + e.verificationUri)
      console.log("DEVICE_CODE=" + e.userCode)
      console.log("👉 浏览器打开上面网址,输入代码完成登录(15 分钟内有效),等待中...")
    }
  },
  signal: AbortSignal.timeout(15 * 60 * 1000),
})
console.log("CREDENTIAL_JSON=" + JSON.stringify(cred))
' > "$OUT")
  LINE=$(grep '^CREDENTIAL_JSON=' "$OUT" | tail -1)
  rm -f "$OUT"
  if [ -z "$LINE" ]; then
    echo "❌ 登录未完成"
    exit 1
  fi
  read -r A R E <<< "$(python3 -c "
import json
c = json.loads('''${LINE#CREDENTIAL_JSON=}''')
print(c['access'], c['refresh'], c['expires'])")"
  record_upsert "$A" "$R" "$E"
  echo "ℹ️  运行 ~/workspace/deepseek-harness/start-dsh.sh 重启后生效"
  ;;

*)
  grep '^#' "$0" | sed 's/^# \?//'
  exit 1
  ;;
esac
