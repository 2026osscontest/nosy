// assets/character/frames.json을 프레임워크 무관하게 소비하는 순수 함수 모듈.
// 캐릭터 애셋이 같은 구조(sprites/{state}_{n}.png + frames.json)로 통째로 바뀌어도
// 이 파일은 손대지 않아도 된다 (assets/character/README.md "연동 지점" 참조).

import framesManifest from '../../../assets/character/frames.json'
import type { PetState } from '@nosy/core'

interface FramesManifest {
  width: number
  height: number
  fps: number
  states: Record<string, unknown[]>
}

const frames = framesManifest as FramesManifest

export const CHARACTER_WIDTH = frames.width
export const CHARACTER_HEIGHT = frames.height
export const CHARACTER_FPS = frames.fps

/** state에 해당하는 프레임 개수. frames.json에 없는 state면 0. */
export function frameCount(state: PetState): number {
  return frames.states[state]?.length ?? 0
}

/** 경과 시간(ms) -> 현재 프레임 인덱스. fps·frameCount 기준으로 루프. frameCount가 0이면 0. */
export function frameIndexAt(elapsedMs: number, state: PetState, fps: number = CHARACTER_FPS): number {
  const count = frameCount(state)
  if (count === 0) return 0
  return Math.floor(elapsedMs / (1000 / fps)) % count
}

/** sprites/{state}_{frame}.png 파일명에서 확장자를 뺀 stem. */
export function spriteKey(state: PetState, frame: number): string {
  return `${state}_${frame}`
}
