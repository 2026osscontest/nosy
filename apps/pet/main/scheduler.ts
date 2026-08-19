// 실행 시 1회 + 30분마다(자체형 어댑터만) + 절전 해제 시(전체) 트리거.
// docs/specs/drift-detection-spec.md FR-005, FR-006 참조.
// TODO: 어댑터 5종이 준비되는 대로 실제 진단 실행을 연결한다 (D6).

import type { BrowserWindow } from 'electron'

export function startScheduler(_window: BrowserWindow): void {}
