/** Browser-to-Host request carrying one CPA-exported Codex credential file. */
export interface CodexCredentialImportRequest {
  /** Original local filename for diagnostics only; never interpreted as a path. */
  readonly fileName: string
  /** Complete UTF-8 JSON text selected in the browser. */
  readonly content: string
}

/** Stable user-facing rejection classes for an import attempt. */
export type CodexCredentialImportErrorCode =
  | 'non-loopback'
  | 'file-too-large'
  | 'invalid-json'
  | 'not-codex'
  | 'disabled-credential'
  | 'missing-token'
  | 'invalid-expiry'

/** Successful durable replacement and restart scheduling metadata. */
export interface CodexCredentialImportSuccess {
  readonly ok: true
  readonly expiresAt: number
  readonly restartScheduled: boolean
}

/** Rejected import; the previous stored grant remains authoritative. */
export interface CodexCredentialImportFailure {
  readonly ok: false
  readonly code: CodexCredentialImportErrorCode
  readonly message: string
}

/** Business result nested inside the transport-level Remote response. */
export type CodexCredentialImportResult = CodexCredentialImportSuccess | CodexCredentialImportFailure
