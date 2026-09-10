/** Trusted CPA Codex credential import and local DSH restart Remote. */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type { CredentialRecord } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { recordKeyFor } from '@deepseek-ai/dsh-llm-pi-ai'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type {
  CodexCredentialImportFailure,
  CodexCredentialImportRequest,
  CodexCredentialImportResult,
} from './types.ts'

export type * from './types.ts'

const MAX_CREDENTIAL_BYTES = 64 * 1024
const RESTART_LABEL = 'com.deepseek.harness.web'
const RESTART_DELAY_SECONDS = 2

interface ImportedGrant {
  readonly record: CredentialRecord
  readonly expiresAt: number
}

function failure(
  code: CodexCredentialImportFailure['code'],
  message: string,
): CodexCredentialImportFailure {
  return { ok: false, code, message }
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function jwtExpiry(access: string): number | undefined {
  try {
    const payload = access.split('.')[1]
    if (payload === undefined) return undefined
    const claims = objectValue(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
    const expiry = claims?.['exp']
    return typeof expiry === 'number' && Number.isFinite(expiry) && expiry > 0
      ? Math.trunc(expiry * 1000)
      : undefined
  } catch {
    return undefined
  }
}

function isoExpiry(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const expiry = Date.parse(value)
  return Number.isFinite(expiry) && expiry > 0 ? expiry : undefined
}

/**
 * Validate and convert one CPA JSON document without exposing its token values.
 * @param content - Complete UTF-8 CPA JSON document.
 * @returns Converted owner record and expiry, or a secret-free rejection.
 */
export function parseCpaCodexCredential(content: string): ImportedGrant | CodexCredentialImportFailure {
  if (Buffer.byteLength(content, 'utf8') > MAX_CREDENTIAL_BYTES) {
    return failure('file-too-large', '凭证文件超过 64 KiB。')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return failure('invalid-json', '所选文件不是有效的 JSON。')
  }
  const credential = objectValue(parsed)
  if (credential?.['type'] !== 'codex') {
    return failure('not-codex', '所选文件不是 CPA 导出的 Codex 凭证。')
  }
  if (credential['disabled'] === true) {
    return failure('disabled-credential', 'CPA 已将这条 Codex 凭证标记为停用。')
  }
  const access = credential['access_token']
  const refresh = credential['refresh_token']
  if (typeof access !== 'string' || access.length === 0
    || typeof refresh !== 'string' || refresh.length === 0) {
    return failure('missing-token', '凭证缺少 access_token 或 refresh_token。')
  }
  const expiresAt = isoExpiry(credential['expired']) ?? jwtExpiry(access)
  if (expiresAt === undefined) {
    return failure('invalid-expiry', '凭证过期时间无法解析。')
  }
  return {
    expiresAt,
    record: {
      kind: 'grant',
      payload: { type: 'oauth', access, refresh, expires: expiresAt },
    },
  }
}

/**
 * Schedule a detached launchctl command after the Remote response can flush.
 * @returns Whether the restart command was accepted for detached execution.
 */
export function scheduleLocalDshRestart(): boolean {
  if (process.platform !== 'darwin' || process.getuid === undefined || !existsSync('/bin/launchctl')) return false
  const target = `gui/${process.getuid()}/${RESTART_LABEL}`
  try {
    const child = spawn(
      '/bin/sh',
      ['-c', `sleep ${RESTART_DELAY_SECONDS}; exec /bin/launchctl kickstart -k "$1"`, 'dsh-restart', target],
      {
        detached: true,
        stdio: 'ignore',
        env: { HOME: process.env['HOME'] ?? '', PATH: '/usr/bin:/bin:/usr/sbin:/sbin' },
      },
    )
    child.once('error', () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

/** Remote owner for one durable openai-codex credential replacement. */
export class CodexCredentialImportGateway extends TypertRemoteService {
  static inject = ['credentials', 'webServer']

  constructor(ctx: Context) {
    super(ctx, 'codexCredentialImport')
  }

  /**
   * Validate one browser-selected CPA export, atomically replace the pi-ai
   * `openai-codex` grant, then schedule the local LaunchAgent restart.
   * @param request - Browser-selected filename and complete JSON text.
   * @returns Secret-free validation or committed-import metadata.
   */
  @Remote('importAndRestart')
  async importAndRestart(request: CodexCredentialImportRequest): Promise<CodexCredentialImportResult> {
    if (this.ctx.webServer.host !== '127.0.0.1') {
      return failure('non-loopback', '为保护凭证，此功能只允许在本机回环地址上的 DSH 中使用。')
    }
    const converted = parseCpaCodexCredential(request.content)
    if ('ok' in converted) return converted
    await this.ctx.credentials.modifyRecord(
      recordKeyFor('openai-codex'),
      () => Promise.resolve(converted.record),
    )
    return {
      ok: true,
      expiresAt: converted.expiresAt,
      restartScheduled: scheduleLocalDshRestart(),
    }
  }
}

export default CodexCredentialImportGateway
