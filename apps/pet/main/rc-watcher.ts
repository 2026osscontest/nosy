// 사용자가 에디터로 rc 파일을 고치는 순간 트리거. drift-detection-spec FR-005의
// 트리거 3종(실행 시 1회 · 30분 · 절전 해제)에 "직접 고친 순간"을 더한다 —
// 고치고 앱으로 돌아왔을 때 재진단 버튼을 누르지 않아도 이미 반영돼 있어야 한다.
//
// 기동만으로는 진단하지 않는다 — 최초 1회는 renderer 마운트가 이미 담당한다
// (scheduler.ts와 같은 이유).
//
// 진단은 반드시 registerIpcHandlers가 반환한 runner로만 돌린다. 자체 진단 로직을 두면
// 단일 실행 가드를 우회해 타이머·사용자 클릭과 겹칠 때 어댑터 캐시가 엉킨다.

import { watchFile } from 'node:fs'
import type { Stats } from 'node:fs'
import type { DiagnosticsRunner } from './ipc'

// packages/core/src/adapters/shell-rc.ts의 RC_FILENAMES와 같은 목록이다.
// 그쪽은 export되어 있지 않아 여기에 따로 둔다 — 한쪽을 고치면 다른 쪽도 고쳐야 한다.
const RC_FILENAMES = ['.zshrc', '.bashrc', '.zprofile']

// stat 폴링 간격. 짧으면 상주 앱이 계속 stat을 돌고, 길면 고쳐도 반응이 늦다.
const POLL_INTERVAL_MS = 2000

export function startRcWatcher(runner: DiagnosticsRunner, homedir: string): void {
  for (const filename of RC_FILENAMES) {
    // fs.watch가 아니라 watchFile을 쓴다. 에디터 대부분은 "임시 파일에 쓰고 rename"으로
    // 저장하는데, 그러면 fs.watch는 원본 inode를 붙든 채 에러 한 줄 없이 조용히 죽는다.
    // watchFile은 stat 폴링이라 파일이 통째로 교체돼도 계속 따라간다.
    watchFile(`${homedir}/${filename}`, { interval: POLL_INTERVAL_MS }, (curr: Stats, prev: Stats) => {
      // 파일이 그대로여도 폴링할 때마다 불리므로 실제 변화만 걸러낸다.
      // 없는 파일의 mtimeMs는 0이라 생성·삭제도 여기서 자연히 변화로 잡힌다.
      if (curr.mtimeMs === prev.mtimeMs) return

      // rc 파일 내용이 달라졌을 뿐이므로 brew doctor까지 돌릴 이유가 없다 (FR-006).
      void runner.run('self')
    })
  }
}
