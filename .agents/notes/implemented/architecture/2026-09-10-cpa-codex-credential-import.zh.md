# Agent Note: 本机 CPA Codex 凭证导入

Status: implemented

[English](2026-09-10-cpa-codex-credential-import.md) | 中文

## 问题

本机 DSH 用户可以从 CPA 获得更新后的 Codex OAuth 凭证，但此前将该凭证迁入 DSH 需要运行 shell 脚本并手动重启进程。通用的浏览器凭证记录写入器会破坏记录所有权，而暴露 token 或接受文件系统路径会扩大 Web 信任边界。

## 决策

Web 组合挂载一个成对功能：`host/codex-credential-import` 拥有一个窄 Typert Remote，`client/ui-codex-credential-import` 向现有插件设置 slot 贡献一个标签页。浏览器选择有大小上限的 JSON 文件，并要求再次明确点击导入。它向 Host 发送 UTF-8 文本，且从不解释或显示 token 值。

Host 只接受已启用、`type: codex` 且 `access_token` 与 `refresh_token` 非空的 CPA 对象。它将 payload 映射为 `llm-pi-ai/openai-codex` 所有者格式，再通过 `CredentialProvider.modifyRecord()` 替换记录。响应不包含 token 材料。

持久写入后，macOS 为 `com.deepseek.harness.web` 调度一个脱离当前进程、延迟执行的 `launchctl kickstart -k`。延迟保留 RPC 确认；客户端在四秒后刷新。其他平台保留成功的凭证写入，并报告未调度重启。

## 安全边界

该操作属于回环地址 Web 部署，而不是通用凭证 API。浏览器与 Host 均执行 64 KiB 上限，原始文件名只是诊断数据而不是路径，实现不会访问 `~/.codex/auth.json`。校验失败会保留先前记录。测试只使用合成 token 字符串。

## 考虑过的替代方案

**保留 shell 导入器。** 它实现较小，但无法满足完全在当前 GUI 中点击完成导入的产品要求。

**通过 RPC 暴露通用凭证记录修改。** 它会允许浏览器代码绕过定义各 grant payload 的插件所有者，并建立明显更宽的秘密管理表面。

**直接写 credentials YAML。** 它会绕过凭证 provider 的锁、原子持久化、更新事件、权限和记录语法。

**在确认 RPC 前重启。** 先终止 Host 会让成功导入与传输失败无法区分，并诱发不安全的重试。

## 后果

该功能为本机 Web 用户提供狭窄、可审计的导入流程，并让持久化继续受凭证所有者管理。已发布组合增加两个包和一个生成的 Remote namespace。自动重启刻意绑定到已发布的 macOS LaunchAgent label；非 LaunchAgent 与远程部署成功导入后不提供重启自动化。

Host 测试固定拒绝、转换、原子替换和重启顺序。Client 测试固定有界选择、明确提交、不泄露秘密的错误呈现、Remote 注册和刷新行为。已发布 Web patch 与 bundle 依赖固定真实部署组合。
