# @deepseek-ai/dsh-host-codex-credential-import

English | [中文](README.zh.md)

Trusted Host boundary for replacing the `llm-pi-ai/openai-codex` OAuth grant from a CPA-exported JSON document. `CodexCredentialImportGateway` publishes the Typert Remote `codexCredentialImport/importAndRestart`. It accepts at most 64 KiB, requires an enabled `type: codex` record with non-empty access and refresh tokens, converts CPA's ISO expiry to milliseconds, and commits the resulting opaque grant through `credentials.modifyRecord()`.

After a successful commit on macOS, the Remote starts a detached two-second delayed `launchctl kickstart -k gui/<uid>/com.deepseek.harness.web`. The delay lets the RPC response reach the browser before this process exits. Responses contain only validation status, expiry, and restart scheduling status; tokens are never logged or returned. The browser supplies text, not a path, and this package never reads or changes native Codex's `~/.codex/auth.json`.

The package is intentionally deployment-specific: the Remote is mounted only by the local Web bundle and relies on that bundle's loopback trust boundary. Its generated Host and Client Remote artifacts are exported through `./typert` and `./remote`; client-safe payload types live at `./types`.

## Model Experience

None, as this Host service does not register tools, prompts, messages, or provider requests.

#### KV Cache effect

None; credential replacement occurs outside model input assembly.

## Known Limitations and Deferred Work

- **LaunchAgent-specific restart** — automatic restart is available only on macOS for the shipped `com.deepseek.harness.web` LaunchAgent; a successful import reports `restartScheduled: false` elsewhere.
- **CPA Codex schema only** — API keys, native Codex auth files, other CPA credential types, and remote DSH deployments are rejected or out of scope.
