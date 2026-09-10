# @deepseek-ai/dsh-client-ui-codex-credential-import

[English](README.md) | 中文

无需本地脚本即可导入 CPA Codex 凭证的 Web 设置贡献。浏览器插件在 `settings.plugins.tab` 中注册本地化的 `codex-credential` 条目。该标签页接受一个不超过 64 KiB 的 JSON 文件，只显示文件名，并且仅在用户点击“导入并重启 DSH”后执行破坏性的替换。

浏览器在内存中读取所选文件，并将其发送给 `ctx.remote.codexCredentialImport.importAndRestart()`。校验、凭证所有权、持久替换和重启调度仍由 Host 负责。成功后，组件清空文件输入、显示重启状态，并在已调度重启时于四秒后重新加载当前页面。Token 内容从不渲染或写入日志。

## 模型体验

无，因为本包只贡献浏览器设置标签页，不提供面向模型的能力。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **每次只处理一个明确选择的文件** —— 不提供拖放、账号目录、凭证预览或批量导入。
- **本机重启恢复** —— 页面只执行一次延迟刷新；它不会轮询远程部署，也不会在重连后保留所选文件。
