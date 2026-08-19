// 렌더러 교체 지점. 2D -> 3D 전환 시 이 파일만 교체한다 (docs/ADR.md ADR-001).
// 계약: 펫 상태(idle/thinking/worried/alarmed)를 받아 그린다. 바깥 코드는 구현을 모른다.

import type { PetState } from '@nosy/core'

interface PetViewProps {
  state: PetState
}

export function PetView({ state }: PetViewProps) {
  return <div className="pet-view" data-state={state} />
}
