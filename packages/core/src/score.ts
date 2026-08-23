// 헬스 스코어 산출. docs/specs/health-score-spec.md 참조.
// 배점표는 아래 상수로 고정한다 — 영상·보고서에 점수를 노출하므로 실행마다 달라지면 안 된다
// (health-score-spec Success Criteria).

import type { AdapterDeduction, AdapterResult, HealthGrade, HealthScore, Severity } from './types.js'

const MAX_SCORE = 100
const MIN_SCORE = 0
/** severity별 감점 (FR-001). */
const DEDUCTION_BY_SEVERITY: Record<Severity, number> = { ok: 0, warn: 5, error: 15 }
/** 어댑터 1개의 감점 상한 (FR-002). 어댑터마다 독립적으로 적용한다. */
const MAX_DEDUCTION_PER_ADAPTER = 30

const GRADE_NORMAL_MIN = 90
const GRADE_CAUTION_MIN = 70

function deductionFor(result: AdapterResult): number {
  const raw = result.findings.reduce(
    (sum, finding) => sum + DEDUCTION_BY_SEVERITY[finding.severity],
    0
  )
  return Math.min(raw, MAX_DEDUCTION_PER_ADAPTER)
}

function gradeFor(score: number): HealthGrade {
  if (score >= GRADE_NORMAL_MIN) return '정상'
  if (score >= GRADE_CAUTION_MIN) return '주의'
  return '문제 있음'
}

/**
 * 100점에서 시작해 어댑터별로 감점한다. 순수 함수다 — 파일시스템·셸·현재 시각에 접근하지 않는다.
 * skip된 어댑터는 감점도 하지 않고 `deductions`에도 넣지 않는다 (FR-004).
 */
export function computeHealthScore(results: AdapterResult[]): HealthScore {
  const deductions: AdapterDeduction[] = results
    .filter((result) => !result.skipped)
    .map((result) => ({ adapter: result.adapter, deduction: deductionFor(result) }))

  const total = deductions.reduce((sum, { deduction }) => sum + deduction, 0)
  const score = Math.max(MAX_SCORE - total, MIN_SCORE)

  return { score, grade: gradeFor(score), deductions }
}
