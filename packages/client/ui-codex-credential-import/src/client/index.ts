/** Codex CPA credential import tab registered into Web Plugin settings. */

import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import {
  CodexCredentialImportTab,
  type CodexCredentialImportTabInjected,
} from './CodexCredentialImportTab.tsx'
import { en, zh, type CodexCredentialImportLocaleKey } from './locales.ts'

export type {
  CodexCredentialImportTabInjected,
  CodexCredentialImportTabProps,
} from './CodexCredentialImportTab.tsx'
export type { CodexCredentialImportLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.codexCredentialImport': CodexCredentialImportLocaleKey
  }
}

/** Locale namespace owned by the Codex credential import tab. */
export const NS = 'settings.codexCredentialImport'
export const inject = ['slots', 'locale', 'remote', 'remote.codexCredentialImport']

/** Contribute the credential importer as a feature-owned Plugins tab. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-codex-credential-import: dictionaries')
  const t = ctx.locale.bind(NS)
  const importAndRestart: CodexCredentialImportTabInjected['importAndRestart'] = async (fileName, content) => {
    const response = await ctx.remote.codexCredentialImport.importAndRestart({ fileName, content })
    if (!response.ok) {
      throw new Error(`codexCredentialImport.importAndRestart failed: ${response.error.code}`)
    }
    return response.value
  }
  const reloadAfterRestart = () => {
    globalThis.setTimeout(() => { globalThis.location.reload() }, 4000)
  }

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'codex-credential',
    order: 5,
    label: () => t('tab'),
    locale: NS,
    inject: () => ({ importAndRestart, reloadAfterRestart }),
  }, CodexCredentialImportTab))
}
