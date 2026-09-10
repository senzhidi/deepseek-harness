# @deepseek-ai/dsh-client-ui-codex-credential-import

English | [中文](README.zh.md)

Web Settings contribution for importing a CPA-exported Codex credential without a local script. The browser plugin registers the localized `codex-credential` entry in `settings.plugins.tab`. The tab accepts one JSON file up to 64 KiB, shows only its filename, and performs the destructive replacement only after the user clicks **Import and restart DSH**.

The browser reads the selected file into memory and sends it to `ctx.remote.codexCredentialImport.importAndRestart()`. Validation, credential ownership, durable replacement, and restart scheduling remain Host responsibilities. On success the component clears the file input, displays restart status, and reloads the current page after four seconds when a restart was scheduled. Token contents are never rendered or logged.

## Model Experience

None, as this package contributes only a browser Settings tab and no model-facing capability.

#### KV Cache effect

None; the package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **One explicit file at a time** — there is no drag-and-drop, account catalog, credential preview, or batch import.
- **Local restart recovery** — the page performs one delayed reload; it does not poll a remote deployment or preserve the selected file across reconnects.
