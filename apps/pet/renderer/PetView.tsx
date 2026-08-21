// 렌더러 교체 지점. 2D -> 3D 전환 시 이 파일만 교체한다 (docs/ADR.md ADR-001).
// 계약: 펫 상태(idle/thinking/worried/alarmed)를 받아 그린다. 바깥 코드는 구현을 모른다.

import { useEffect, useState } from 'react'
import type { PetState } from '@nosy/core'
import { CHARACTER_FPS, CHARACTER_HEIGHT, CHARACTER_WIDTH, frameIndexAt, spriteKey } from './character'

// 캐릭터 애셋이 같은 파일명 규칙으로 통째로 바뀌어도 여기 코드는 손대지 않는다 —
// 파일 목록을 하드코딩하지 않고 glob으로 sprites/*.png를 전부 흡수한다.
const spriteModules = import.meta.glob('../../../assets/character/sprites/*.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>

const spriteUrls: Record<string, string> = {}
for (const [path, url] of Object.entries(spriteModules)) {
  const stem = path.replace(/^.*\//, '').replace(/\.png$/, '')
  spriteUrls[stem] = url
}

const SCALE = 8

interface PetViewProps {
  state: PetState
}

export function PetView({ state }: PetViewProps) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    setElapsedMs(0)
    const start = performance.now()
    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - start)
    }, 1000 / CHARACTER_FPS)
    return () => window.clearInterval(id)
  }, [state])

  const frame = frameIndexAt(elapsedMs, state)
  const url = spriteUrls[spriteKey(state, frame)]

  return (
    <div className="pet-view" data-state={state}>
      {url && (
        <img
          src={url}
          alt=""
          width={CHARACTER_WIDTH * SCALE}
          height={CHARACTER_HEIGHT * SCALE}
          style={{ imageRendering: 'pixelated' }}
        />
      )}
    </div>
  )
}
