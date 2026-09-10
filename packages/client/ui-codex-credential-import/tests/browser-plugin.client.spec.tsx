// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { CodexCredentialImportTab } from '../src/client/CodexCredentialImportTab.tsx'
import type { CodexCredentialImportTabInjected } from '../src/client/CodexCredentialImportTab.tsx'
import { apply, inject, NS } from '../src/client/index.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  const importAndRestart = vi.fn().mockResolvedValue({
    ok: true,
    value: { ok: true, expiresAt: Date.now() + 60_000, restartScheduled: false },
  })
  ctx.provide('remote.codexCredentialImport', { importAndRestart })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, importAndRestart }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-codex-credential-import browser plugin', () => {
  it('registers the localized real tab and invokes the generated Remote face', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugins.tab')[0]!
    expect(entry.component).toBe(CodexCredentialImportTab)
    expect(entry.options).toMatchObject({ id: 'codex-credential', order: 5 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('Codex 凭证')

    const injected = (entry.inject as unknown as () => CodexCredentialImportTabInjected)()
    await expect(injected.importAndRestart('fixture.json', '{}')).resolves.toMatchObject({ ok: true })
    expect(b.importAndRestart).toHaveBeenCalledWith({ fileName: 'fixture.json', content: '{}' })
    await b.ctx.fiber.dispose()
  })

  it('throws transport failures without exposing the selected document', async () => {
    const b = await bench()
    declare(b.slots)
    b.importAndRestart.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'private' } })
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('settings.plugins.tab')[0]!
    const injected = (entry.inject as unknown as () => CodexCredentialImportTabInjected)()

    await expect(injected.importAndRestart('fixture.json', 'secret-body'))
      .rejects.toThrow('codexCredentialImport.importAndRestart failed: REMOTE_ERROR')
    await b.ctx.fiber.dispose()
  })
})
