import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { CodexCredentialImportResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CodexCredentialImportLocaleKey } from './locales.ts'
import css from './CodexCredentialImportTab.module.css'

const MAX_CREDENTIAL_BYTES = 64 * 1024

/** Registration-side operations used by the import tab. */
export interface CodexCredentialImportTabInjected {
  importAndRestart: (fileName: string, content: string) => Promise<CodexCredentialImportResult>
  reloadAfterRestart: () => void
}

export type CodexCredentialImportTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.codexCredentialImport'>
  & InjectFace<CodexCredentialImportTabInjected>

type ImportState =
  | { readonly status: 'idle' }
  | { readonly status: 'importing' }
  | { readonly status: 'success'; readonly restartScheduled: boolean }
  | { readonly status: 'error'; readonly message: string }

/** Render the local-file picker and one explicit destructive import action. */
export function CodexCredentialImportTab({
  importAndRestart,
  reloadAfterRestart,
  t,
}: CodexCredentialImportTabProps): ReactNode {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [state, setState] = useState<ImportState>({ status: 'idle' })

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    setFile(selected)
    setState(selected !== undefined && (selected.size > MAX_CREDENTIAL_BYTES || !selected.name.endsWith('.json'))
      ? { status: 'error', message: t('invalidFile') }
      : { status: 'idle' })
  }

  const submit = async () => {
    if (file === undefined || file.size > MAX_CREDENTIAL_BYTES || !file.name.endsWith('.json')) {
      setState({ status: 'error', message: t('invalidFile') })
      return
    }
    setState({ status: 'importing' })
    let content: string
    try {
      content = await file.text()
    } catch {
      setState({ status: 'error', message: t('readFailed') })
      return
    }
    try {
      const result = await importAndRestart(file.name, content)
      content = ''
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      setFile(undefined)
      if (input.current !== null) input.current.value = ''
      setState({ status: 'success', restartScheduled: result.restartScheduled })
      if (result.restartScheduled) reloadAfterRestart()
    } catch {
      content = ''
      setState({ status: 'error', message: t('transportFailed') })
    }
  }

  const busy = state.status === 'importing' || state.status === 'success'
  return (
    <section className={css.section}>
      <div className={css.heading}>
        <h3>{t('title')}</h3>
        <p>{t('intro')}</p>
      </div>
      <p className={css.security}>{t('security')}</p>
      <div className={css.picker}>
        <label className={css.choose}>
          <span>{t('choose')}</span>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={selectFile}
          />
        </label>
        <span className={css.fileName}>
          {file === undefined ? t('noFile') : t('selected', { name: file.name })}
        </span>
      </div>
      <button
        className={css.submit}
        type="button"
        disabled={file === undefined || busy || state.status === 'error'}
        onClick={() => { void submit() }}
      >
        {state.status === 'importing' ? t('importing') : t('import')}
      </button>
      {state.status === 'error' ? <p className={css.error} role="alert">{state.message}</p> : null}
      {state.status === 'success' ? (
        <p className={state.restartScheduled ? css.success : css.warning} role="status">
          {t(state.restartScheduled ? 'success' : 'successNoRestart')}
        </p>
      ) : null}
    </section>
  )
}

export type { CodexCredentialImportLocaleKey }
