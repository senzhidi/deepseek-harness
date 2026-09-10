#!/bin/zsh
# start-dsh.sh —— 启动 DeepSeek Harness(Codex OAuth 需要 Clash 代理出站)
# 用法:先开 Clash Verge,然后运行  ~/workspace/deepseek-harness/start-dsh.sh
# 换代理端口:DSH_PROXY_PORT=7890 ~/workspace/deepseek-harness/start-dsh.sh

set -u

PROXY_PORT="${DSH_PROXY_PORT:-7899}"   # 本机 Clash 混合端口
DIR="$HOME/workspace/deepseek-harness"
LOG="${TMPDIR:-/tmp}/dsh-web.log"

# 0. 用真实请求检查代理可用性(没跑只警告,不拦着启动:DeepSeek 渠道走公司网关不需要代理)
if ! curl -s -o /dev/null -m 3 -x "http://127.0.0.1:$PROXY_PORT" https://chatgpt.com/ 2>/dev/null; then
  echo "⚠️  无法通过 127.0.0.1:$PROXY_PORT 访问外网——Clash Verge 没开?Codex 登录/调用会失败。"
  echo "    如果你的混合端口不是 $PROXY_PORT,用 DSH_PROXY_PORT=端口 重新运行。"
fi

# 1. 停掉旧实例(包括之前由 Cursor 终端启动的)
pkill -f "pnpm dsh web" 2>/dev/null
pkill -f "apps/cli/src/bin.ts web" 2>/dev/null
sleep 1

# 2. 带代理启动(NO_PROXY 保证本机 UI 和公司网关直连不受影响)
#    直接用 node 启动,绕开 pnpm 的 run 前依赖校验(会联网装包,版本不一致时卡死)
cd "$DIR"
export HTTPS_PROXY="http://127.0.0.1:$PROXY_PORT"
export HTTP_PROXY="http://127.0.0.1:$PROXY_PORT"
export NO_PROXY="127.0.0.1,localhost"
export NODE_USE_ENV_PROXY=1   # 让 Node 内置 fetch 也走代理(pi-ai 的 codex 请求是裸 fetch)
nohup node --import tsx/esm apps/cli/src/bin.ts web --no-open >"$LOG" 2>&1 &

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
