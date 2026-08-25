// 30분마다(자체형 어댑터만) + 절전 해제 시(전체) 트리거.
// docs/specs/drift-detection-spec.md FR-005, FR-006 참조.
//
// FR-005 ①("앱 실행 시 1회")은 여기에 없다 — renderer가 마운트될 때
// window.nosy.run('all')을 호출해 이미 충족된다(apps/pet/renderer/main.tsx).
// 스케줄러에서 또 걸면 기동 직후 진단이 중복 트리거된다.
//
// 진단은 반드시 registerIpcHandlers가 반환한 runner로만 돌린다. IPC 채널과 같은
// 단일 실행 가드를 공유해야 타이머와 사용자 클릭이 겹쳐도 어댑터 캐시가 엉키지 않는다.

import { powerMonitor } from 'electron'
import type { DiagnosticsRunner } from './ipc'

const SELF_CHECK_INTERVAL_MS = 30 * 60 * 1000

export function startScheduler(runner: DiagnosticsRunner): void {
  setInterval(() => void runner.run('self'), SELF_CHECK_INTERVAL_MS)

  // 절전 중에 brew·버전 매니저 상태가 바뀌었을 수 있으므로 래핑형까지 전부 돈다.
  powerMonitor.on('resume', () => void runner.run('all'))
}
