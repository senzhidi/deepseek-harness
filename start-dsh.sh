#!/bin/zsh
# start-dsh.sh —— 启动 DeepSeek Harness(Codex OAuth 需要 Clash 代理出站)
# 用法:先开 Clash Verge,然后运行  ~/workspace/deepseek-harness/start-dsh.sh
# 换代理端口:DSH_PROXY_PORT=7890 ~/workspace/deepseek-harness/start-dsh.sh

set -u

PROXY_PORT="${DSH_PROXY_PORT:-7899}"   # 本机 Clash 混合端口
DIR="$HOME/workspace/deepseek-harness"
LOG="${TMPDIR:-/tmp}/dsh-web.log"

# 0. Codex 官方登录与调用必须经代理；代理不可用时拒绝退回无代理启动。
if ! nc -z 127.0.0.1 "$PROXY_PORT" 2>/dev/null \
  || ! curl -s -o /dev/null -m 8 -x "http://127.0.0.1:$PROXY_PORT" https://chatgpt.com/ 2>/dev/null; then
  echo "❌ 无法通过 127.0.0.1:$PROXY_PORT 访问 ChatGPT。请先启动 Clash Verge。"
  echo "   如果混合端口不是 $PROXY_PORT,用 DSH_PROXY_PORT=端口 重新运行。"
  exit 1
fi

# 1. Caster 留下的 LaunchAgent 已负责自启动和保活。若它存在，只重启该唯一实例；
#    不能先 pkill 再 nohup，否则 KeepAlive 会同时拉起另一个进程并争抢 3080。
LABEL="com.deepseek.harness.web"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
if [[ -f "$PLIST" ]]; then
  PLIST_PROXY=$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:HTTPS_PROXY' "$PLIST" 2>/dev/null || true)
  PLIST_NODE_PROXY=$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:NODE_USE_ENV_PROXY' "$PLIST" 2>/dev/null || true)
  if [[ "$PLIST_PROXY" != "http://127.0.0.1:$PROXY_PORT" || "$PLIST_NODE_PROXY" != "1" ]]; then
    echo "❌ $PLIST 未配置所需的 Codex 代理；拒绝启动可能直连或走错路由的实例。"
    exit 1
  fi
  launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 \
    || launchctl bootstrap "gui/$(id -u)" "$PLIST"
  launchctl kickstart -k "gui/$(id -u)/$LABEL"
else
  # 没有 LaunchAgent 时才由脚本托管一个后台实例。
  pkill -f "pnpm dsh web" 2>/dev/null || true
  pkill -f "apps/cli/src/bin.ts web" 2>/dev/null || true
  cd "$DIR"
  export HTTPS_PROXY="http://127.0.0.1:$PROXY_PORT"
  export HTTP_PROXY="http://127.0.0.1:$PROXY_PORT"
  export NO_PROXY="127.0.0.1,localhost"
  export NODE_USE_ENV_PROXY=1
  nohup node --import tsx/esm apps/cli/src/bin.ts web --no-open >"$LOG" 2>&1 &
fi

# 3. 等 3080 端口就绪
for i in {1..20}; do
  if curl -s -o /dev/null -m 1 http://127.0.0.1:3080/; then
    echo "✅ DSH 已就绪: http://127.0.0.1:3080 (出站代理 127.0.0.1:$PROXY_PORT,日志: $LOG)"
    exit 0
  fi
  sleep 1
done

echo "❌ 20 秒未就绪,日志尾部:"
tail -20 "$LOG"
exit 1
