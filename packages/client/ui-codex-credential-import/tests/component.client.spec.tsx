// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CodexCredentialImportTab,
  type CodexCredentialImportTabInjected,
  type CodexCredentialImportTabProps,
} from '../src/client/CodexCredentialImportTab.tsx'
import { en, type CodexCredentialImportLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

const t = ((key: CodexCredentialImportLocaleKey, values?: Record<string, unknown>) => {
  const message = en[key]
  const name = values?.['name']
  return name === undefined ? message : message.replace('{{name}}', typeof name === 'string' ? name : '')
}) as CodexCredentialImportTabProps['t']

function props(
  importAndRestart: CodexCredentialImportTabInjected['importAndRestart'],
  reloadAfterRestart = vi.fn(),
): CodexCredentialImportTabProps {
  return { t, importAndRestart, reloadAfterRestart } as CodexCredentialImportTabProps
}

function selectJson(content: string, name = 'codex.json'): File {
  const file = new File([content], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: vi.fn(() => Promise.resolve(content)) })
  fireEvent.change(screen.getByLabelText(en.choose), { target: { files: [file] } })
  return file
}

describe('CodexCredentialImportTab', () => {
  it('sends only the selected file and reloads after successful restart scheduling', async () => {
    const importAndRestart = vi.fn<CodexCredentialImportTabInjected['importAndRestart']>()
      .mockResolvedValue({ ok: true, expiresAt: Date.now() + 60_000, restartScheduled: true })
    const reloadAfterRestart = vi.fn()
    render(<CodexCredentialImportTab {...props(importAndRestart, reloadAfterRestart)} />)

    const content = JSON.stringify({ type: 'codex', access_token: 'secret' })
    selectJson(content)
    fireEvent.click(screen.getByRole('button', { name: en.import }))

    await waitFor(() => { expect(importAndRestart).toHaveBeenCalledWith('codex.json', content) })
    expect((await screen.findByRole('status')).textContent).toBe(en.success)
    expect(reloadAfterRestart).toHaveBeenCalledOnce()
    expect(screen.getByText(en.noFile)).toBeTruthy()
  })

  it('shows Host validation text and does not reload', async () => {
    const importAndRestart = vi.fn<CodexCredentialImportTabInjected['importAndRestart']>()
      .mockResolvedValue({ ok: false, code: 'disabled-credential', message: 'CPA disabled this credential.' })
    const reloadAfterRestart = vi.fn()
    render(<CodexCredentialImportTab {...props(importAndRestart, reloadAfterRestart)} />)

    selectJson('{}')
    fireEvent.click(screen.getByRole('button', { name: en.import }))

    expect((await screen.findByRole('alert')).textContent).toBe('CPA disabled this credential.')
    expect(reloadAfterRestart).not.toHaveBeenCalled()
  })

  it('rejects an oversized file before reading or invoking the Remote', () => {
    const importAndRestart = vi.fn<CodexCredentialImportTabInjected['importAndRestart']>()
    render(<CodexCredentialImportTab {...props(importAndRestart)} />)
    const file = new File(['x'.repeat(65 * 1024)], 'large.json', { type: 'application/json' })
    const text = vi.fn()
    Object.defineProperty(file, 'text', { value: text })

    fireEvent.change(screen.getByLabelText(en.choose), { target: { files: [file] } })

    expect(screen.getByRole('alert').textContent).toBe(en.invalidFile)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: en.import }).disabled).toBe(true)
    expect(text).not.toHaveBeenCalled()
    expect(importAndRestart).not.toHaveBeenCalled()
  })
})
