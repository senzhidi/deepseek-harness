# @deepseek-ai/dsh-host-codex-credential-import

[English](README.md) | 中文

从 CPA 导出的 JSON 文档替换 `llm-pi-ai/openai-codex` OAuth grant 的可信 Host 边界。`CodexCredentialImportGateway` 发布 Typert Remote `codexCredentialImport/importAndRestart`。它最多接受 64 KiB，要求记录为已启用的 `type: codex` 且 access、refresh token 非空，将 CPA 的 ISO 过期时间转换成毫秒，再通过 `credentials.modifyRecord()` 提交生成的不透明 grant。

在 macOS 上成功提交后，Remote 启动一个脱离当前进程、延迟两秒执行的 `launchctl kickstart -k gui/<uid>/com.deepseek.harness.web`。这段延迟让 RPC 响应在进程退出前抵达浏览器。响应只包含校验状态、过期时间和重启调度状态；token 从不写入日志或返回。浏览器提交文本而不是路径，本包不会读取或修改原生 Codex 的 `~/.codex/auth.json`。

本包刻意面向特定部署：Remote 只由本机 Web bundle 挂载，并依赖该 bundle 的回环地址信任边界。生成的 Host 和 Client Remote 产物通过 `./typert` 与 `./remote` 导出；客户端安全的 payload 类型位于 `./types`。

## 模型体验

无，因为这个 Host 服务不注册工具、提示词、消息或提供方请求。

#### KV Cache 影响

无；凭证替换发生在模型输入组装之外。

## 已知限制与暂缓事项

- **依赖 LaunchAgent 的重启** —— 自动重启只在 macOS 上对已发布的 `com.deepseek.harness.web` LaunchAgent 可用；其他环境导入成功后会报告 `restartScheduled: false`。
- **仅支持 CPA Codex schema** —— API key、原生 Codex auth 文件、其他 CPA 凭证类型和远程 DSH 部署均会被拒绝或不在范围内。
