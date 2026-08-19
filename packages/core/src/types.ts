// Finding / Snapshot / HealthScore 타입 계약.
// docs/specs/core-types-spec.md, docs/specs/health-score-spec.md, docs/specs/drift-detection-spec.md 참조.

export type Severity = 'ok' | 'warn' | 'error'

export interface Evidence {
  file: string
  line: number
  excerpt: string
}

export interface Fix {
  description: string
  command?: string
  manual?: string
  needsSudo?: boolean
  revert?: string
}

/** evidence 또는 fix.command 중 최소 하나를 반드시 가져야 한다 (core-types-spec FR-008). */
export interface Finding {
  id: string
  adapter: string
  severity: Severity
  title: string
  cause: string
  evidence?: Evidence
  fix: Fix
  reference?: string
}

export interface SnapshotEntry {
  ranAt: string
  findings: Finding[]
}

/** 어댑터별 레코드로 분리 저장한다 (drift-detection-spec FR-002). */
export type Snapshot = Record<string, SnapshotEntry>

export interface DriftResult {
  hasNewError: boolean
  newFindings: Finding[]
}

export type HealthGrade = '정상' | '주의' | '문제 있음'

export interface AdapterDeduction {
  adapter: string
  deduction: number
}

export interface HealthScore {
  score: number
  grade: HealthGrade
  deductions: AdapterDeduction[]
}

export type PetState = 'idle' | 'thinking' | 'worried' | 'alarmed'
