// Finding / Snapshot / HealthScore 타입 계약.
// docs/specs/core-types-spec.md, docs/specs/health-score-spec.md, docs/specs/drift-detection-spec.md 참조.

import type { DiagnosticHost } from './host.js'

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

/**
 * 진단 어댑터 1개의 등록 형태.
 * skip 판정(`isApplicable`)을 실행(`run`)에서 분리한다 — 미설치로 "해당 없음"인 상태와
 * 실행했는데 문제가 0건인 상태를 호출자가 구분할 수 있어야 하기 때문이다
 * (health-score-spec FR-004: skip은 감점도 분모 포함도 하지 않는다).
 */
export interface Adapter {
  name: string
  /**
   * 'self': 외부 CLI에 의존하지 않는 자체 로직 — 30분 주기 체크 대상.
   * 'wrapping': 외부 CLI 래핑(`brew doctor` 등) — 무거우므로 절전 해제·수동 실행에서만 돈다.
   * drift-detection-spec FR-006 참조.
   */
  kind: 'self' | 'wrapping'
  /**
   * 건너뛸 사유를 반환한다. `null`이면 실행한다. 생략하면 항상 실행한다.
   * 사유 문자열은 UI에 "해당 없음"의 이유로 그대로 노출되므로 사용자가 읽을 수 있게 쓴다
   * — "미설치"와 "설치는 됐지만 검사할 수 없음"은 사용자에게 다른 상황이다.
   */
  skipReason?(host: DiagnosticHost): Promise<string | null>
  run(host: DiagnosticHost): Promise<Finding[]>
}

/** 어댑터 1개의 실행 결과. `skipped`면 `findings`는 항상 빈 배열이고 `reason`이 채워진다. */
export interface AdapterResult {
  adapter: string
  ranAt: string
  skipped: boolean
  /** `skipped`일 때만 존재하는, 사용자에게 보여줄 건너뛴 사유. */
  reason?: string
  findings: Finding[]
}
