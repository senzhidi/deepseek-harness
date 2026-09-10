# Agent Note: Local CPA Codex credential import

Status: implemented

English | [中文](2026-09-10-cpa-codex-credential-import.zh.md)

## Problem

A local DSH user can obtain a refreshed Codex OAuth credential from CPA, but moving that credential into DSH previously required a shell script and manual process restart. A generic browser credential-record writer would break record ownership, while exposing tokens or accepting filesystem paths would widen the Web trust boundary.

## Decision

The Web composition mounts a paired feature: `host/codex-credential-import` owns one narrow Typert Remote, and `client/ui-codex-credential-import` contributes one tab to the existing Plugins settings slot. The browser selects a bounded JSON file and requires a second explicit import click. It sends UTF-8 text to the Host and never interprets or displays token values.

The Host accepts only an enabled CPA `type: codex` object with non-empty `access_token` and `refresh_token`. It maps that payload to the `llm-pi-ai/openai-codex` owner format and replaces the record through `CredentialProvider.modifyRecord()`. The response excludes token material.

After the durable write, macOS schedules a detached, delayed `launchctl kickstart -k` for `com.deepseek.harness.web`. The delay preserves the RPC acknowledgement; the client then reloads after four seconds. Other platforms keep the successful credential write and report that restart was not scheduled.

## Security boundary

The operation is part of the loopback Web deployment, not a general credential API. Both browser and Host enforce a 64 KiB limit, the original filename is diagnostic data rather than a path, and the implementation does not access `~/.codex/auth.json`. Validation failures leave the previous record unchanged. Tests use synthetic token strings only.

## Alternatives considered

**Keep the shell importer.** It preserved a small implementation but failed the product requirement that import be fully clickable inside the current GUI.

**Expose generic credential record mutation over RPC.** It would let browser code bypass the plugin owner that defines each grant payload and would create a substantially broader secret-management surface.

**Write the credentials YAML directly.** It would bypass the credential provider's locking, atomic persistence, update event, permissions, and record grammar.

**Restart before acknowledging the RPC.** Terminating the Host first makes a successful import indistinguishable from a failed transport request and encourages unsafe retry behavior.

## Consequences

The feature gives local Web users a narrow, auditable import flow and keeps persistence under the credential owner. It adds two packages and one generated Remote namespace to the shipped composition. Automatic restart is intentionally tied to the shipped macOS LaunchAgent label; non-LaunchAgent and remote deployments receive a successful import without restart automation.

Host tests pin rejection, conversion, atomic replacement, and restart ordering. Client tests pin bounded selection, explicit submission, secret-free error presentation, Remote registration, and reload behavior. The shipped Web patch and bundle dependencies pin the real deployment composition.
