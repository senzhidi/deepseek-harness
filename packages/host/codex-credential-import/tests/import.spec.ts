import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import {
  CredentialProvider,
  type CredentialInfo,
  type CredentialKey,
  type CredentialRecord,
  type CredentialRecordEntry,
  type CredentialRecordInfo,
  type CredentialRef,
  type ResolvedCredential,
} from '@deepseek-ai/dsh-credentials'
import { recordKeyFor } from '@deepseek-ai/dsh-llm-pi-ai'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import CodexCredentialImportGateway, { parseCpaCodexCredential } from '../src/index.ts'

const { spawn } = vi.hoisted(() => ({
  spawn: vi.fn(() => ({ once: vi.fn(), unref: vi.fn() })),
}))
vi.mock('node:child_process', () => ({ spawn }))

class LocalWebServer extends Service {
  readonly host = '127.0.0.1'
  constructor(ctx: Context) { super(ctx, 'webServer') }
}

class MemoryCredentials extends CredentialProvider {
  readonly records = new Map<CredentialKey, CredentialRecord>()
  resolve(_ref: CredentialRef): Promise<ResolvedCredential | undefined> { return Promise.resolve(undefined) }
  describe(_ref: CredentialRef): Promise<CredentialInfo> { return Promise.resolve({ configured: false, writable: true }) }
  set(_ref: CredentialRef, _value: string): Promise<void> { return Promise.resolve() }
  unset(_ref: CredentialRef): Promise<void> { return Promise.resolve() }
  readRecord(key: CredentialKey): Promise<CredentialRecord | undefined> { return Promise.resolve(this.records.get(key)) }
  describeRecord(key: CredentialKey): Promise<CredentialRecordInfo> {
    const record = this.records.get(key)
    return Promise.resolve(record === undefined
      ? { configured: false, writable: true }
      : { configured: true, writable: true, kind: record.kind })
  }
  listRecords(): Promise<readonly CredentialRecordEntry[]> { return Promise.resolve([]) }
  async modifyRecord(
    key: CredentialKey,
    mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    const next = await mutate(this.records.get(key))
    if (next !== undefined) this.records.set(key, next)
    return next
  }
  deleteRecord(key: CredentialKey): Promise<void> { this.records.delete(key); return Promise.resolve() }
}

const contexts: Context[] = []
afterEach(async () => {
  spawn.mockClear()
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

function cpa(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'codex',
    disabled: false,
    access_token: 'access-new',
    refresh_token: 'refresh-new',
    expired: '2099-01-01T00:00:00Z',
    ...overrides,
  })
}

describe('CPA Codex conversion', () => {
  it('converts only the OAuth triple used by llm-pi-ai', () => {
    expect(parseCpaCodexCredential(cpa({ email: 'ignored@example.com', id_token: 'ignored' }))).toEqual({
      expiresAt: Date.parse('2099-01-01T00:00:00Z'),
      record: {
        kind: 'grant',
        payload: {
          type: 'oauth',
          access: 'access-new',
          refresh: 'refresh-new',
          expires: Date.parse('2099-01-01T00:00:00Z'),
        },
      },
    })
  })

  it.each([
    ['invalid-json', '{'],
    ['not-codex', cpa({ type: 'claude' })],
    ['disabled-credential', cpa({ disabled: true })],
    ['missing-token', cpa({ refresh_token: '' })],
    ['invalid-expiry', cpa({ expired: 'not-a-date', access_token: 'not-a-jwt' })],
  ])('rejects %s without producing a record', (code, content) => {
    expect(parseCpaCodexCredential(content)).toMatchObject({ ok: false, code })
  })

  it('bounds the complete UTF-8 document', () => {
    expect(parseCpaCodexCredential('界'.repeat(22_000))).toMatchObject({ ok: false, code: 'file-too-large' })
  })
})

describe('CodexCredentialImportGateway', () => {
  it('publishes one direct import method', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(MemoryCredentials)
    await ctx.plugin(LocalWebServer)
    await ctx.plugin(CodexCredentialImportGateway)
    const gateway = ctx.get('codexCredentialImport') as CodexCredentialImportGateway
    expect(remoteMethods(gateway)).toEqual([{ method: 'importAndRestart', invocation: { kind: 'direct' } }])
  })

  it('atomically replaces the owned record before scheduling restart', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(MemoryCredentials)
    await ctx.plugin(LocalWebServer)
    await ctx.plugin(CodexCredentialImportGateway)
    const credentials = ctx.credentials as MemoryCredentials
    credentials.records.set(recordKeyFor('openai-codex'), { kind: 'grant', payload: { old: true } })
    const gateway = ctx.get('codexCredentialImport') as CodexCredentialImportGateway

    const result = await gateway.importAndRestart({ fileName: 'codex.json', content: cpa() })

    expect(result).toMatchObject({ ok: true, expiresAt: Date.parse('2099-01-01T00:00:00Z') })
    expect(await credentials.readRecord(recordKeyFor('openai-codex'))).toMatchObject({
      kind: 'grant',
      payload: { access: 'access-new', refresh: 'refresh-new' },
    })
    if (process.platform === 'darwin') expect(spawn).toHaveBeenCalledOnce()
  })

  it('refuses credential mutation when Web is not loopback-bound', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(MemoryCredentials)
    await ctx.plugin(LocalWebServer)
    await ctx.plugin(CodexCredentialImportGateway)
    Object.defineProperty(ctx.webServer, 'host', { value: '0.0.0.0' })
    const gateway = ctx.get('codexCredentialImport') as CodexCredentialImportGateway

    await expect(gateway.importAndRestart({ fileName: 'codex.json', content: cpa() }))
      .resolves.toMatchObject({ ok: false, code: 'non-loopback' })
    expect((ctx.credentials as MemoryCredentials).records.size).toBe(0)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('leaves the old record untouched after validation rejection', async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(MemoryCredentials)
    await ctx.plugin(LocalWebServer)
    await ctx.plugin(CodexCredentialImportGateway)
    const credentials = ctx.credentials as MemoryCredentials
    const old = { kind: 'grant', payload: { old: true } } as const
    credentials.records.set(recordKeyFor('openai-codex'), old)
    const gateway = ctx.get('codexCredentialImport') as CodexCredentialImportGateway

    await expect(gateway.importAndRestart({ fileName: 'bad.json', content: cpa({ disabled: true }) }))
      .resolves.toMatchObject({ ok: false, code: 'disabled-credential' })
    expect(await credentials.readRecord(recordKeyFor('openai-codex'))).toEqual(old)
    expect(spawn).not.toHaveBeenCalled()
  })
})
