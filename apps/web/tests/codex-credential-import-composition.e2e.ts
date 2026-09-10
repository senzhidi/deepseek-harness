import { afterEach, expect, it } from 'vitest'
import type { CodexCredentialImportGateway } from '@deepseek-ai/dsh-host-codex-credential-import'
import type { PluginInventoryGateway } from '@deepseek-ai/dsh-host-plugin-inventory'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'

let scaffold: WebScaffold | undefined
afterEach(async () => {
  await scaffold?.close()
  scaffold = undefined
})

it('ships the loopback Codex import Remote and its real browser contribution', async () => {
  scaffold = await launchWebScaffold({ deepSeekMissingCredential: true })
  const inventory = scaffold.ctx.get('pluginInventory') as PluginInventoryGateway
  expect(inventory.list().entries.find(entry => entry.moduleName === '@deepseek-ai/dsh-host-codex-credential-import'))
    .toMatchObject({ enabled: true, fiberPhase: 'active' })
  const gateway = scaffold.ctx.get('codexCredentialImport') as CodexCredentialImportGateway
  expect(gateway).toBeDefined()

  const html = await fetch(`${scaffold.baseUrl}/`).then(response => response.text())
  expect(html).toContain('@deepseek-ai/dsh-client-ui-codex-credential-import')
}, 120_000)
