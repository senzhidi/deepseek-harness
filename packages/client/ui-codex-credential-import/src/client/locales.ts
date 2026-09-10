/** Copy dictionaries for the Codex credential import tab. */

export const zh = {
  tab: 'Codex 凭证',
  title: '导入 Codex 凭证',
  intro: '选择从 CPA 下载的 Codex JSON。导入会替换 DSH 当前的 OpenAI Codex OAuth 凭证，并自动重启 DSH。',
  security: '文件只发送到本机 DSH，不会上传到 CPA 或其他服务。',
  choose: '选择凭证文件',
  noFile: '尚未选择文件',
  selected: '已选择：{{name}}',
  import: '导入并重启 DSH',
  importing: '正在导入…',
  success: '凭证已替换，DSH 正在重启。页面将自动刷新。',
  successNoRestart: '凭证已替换，但当前环境无法自动重启 DSH。',
  invalidFile: '请选择不超过 64 KiB 的 JSON 文件。',
  readFailed: '无法读取所选文件。',
  transportFailed: '导入请求失败，请重试。',
} satisfies Record<string, string>

/** Locale key union shared by both dictionaries. */
export type CodexCredentialImportLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese source keys. */
export const en = {
  tab: 'Codex credential',
  title: 'Import Codex credential',
  intro: 'Select a Codex JSON exported by CPA. Import replaces the current OpenAI Codex OAuth credential and restarts DSH automatically.',
  security: 'The file is sent only to this local DSH instance, never to CPA or another service.',
  choose: 'Choose credential file',
  noFile: 'No file selected',
  selected: 'Selected: {{name}}',
  import: 'Import and restart DSH',
  importing: 'Importing…',
  success: 'Credential replaced. DSH is restarting and this page will refresh.',
  successNoRestart: 'Credential replaced, but DSH cannot restart automatically in this environment.',
  invalidFile: 'Choose a JSON file no larger than 64 KiB.',
  readFailed: 'The selected file could not be read.',
  transportFailed: 'The import request failed. Try again.',
} satisfies Record<CodexCredentialImportLocaleKey, string>
