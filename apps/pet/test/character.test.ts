// PetView가 assets/character를 어떻게 스왑 가능한 방식으로 소비하는지 검증하는 순수 함수 테스트.
// DOM/React 렌더링에는 의존하지 않는다 — apps/pet/renderer/character.ts가 만들어질 대상.
import { describe, expect, it } from 'vitest'
import { CHARACTER_FPS, CHARACTER_HEIGHT, CHARACTER_WIDTH, frameCount, frameIndexAt, spriteKey } from '../renderer/character'

describe('character manifest (assets/character/frames.json에서 읽음)', () => {
  it('원본 해상도 22x18을 그대로 노출한다', () => {
    expect(CHARACTER_WIDTH).toBe(22)
    expect(CHARACTER_HEIGHT).toBe(18)
  })

  it('idle 상태의 프레임 수를 manifest에서 읽는다', () => {
    expect(frameCount('idle')).toBe(4)
  })

  it('4종 상태 모두 프레임을 갖는다', () => {
    expect(frameCount('idle')).toBeGreaterThan(0)
    expect(frameCount('thinking')).toBeGreaterThan(0)
    expect(frameCount('worried')).toBeGreaterThan(0)
    expect(frameCount('alarmed')).toBeGreaterThan(0)
  })
})

describe('frameIndexAt (경과 시간 -> 프레임 인덱스)', () => {
  it('경과 0ms에서는 0번 프레임', () => {
    expect(frameIndexAt(0, 'idle')).toBe(0)
  })

  it('fps당 1프레임씩 진행한다', () => {
    const msPerFrame = 1000 / CHARACTER_FPS
    expect(frameIndexAt(msPerFrame, 'idle')).toBe(1)
    expect(frameIndexAt(msPerFrame * 2, 'idle')).toBe(2)
  })

  it('마지막 프레임 이후 0번으로 되돌아간다(루프)', () => {
    const msPerFrame = 1000 / CHARACTER_FPS
    const count = frameCount('idle')
    expect(frameIndexAt(msPerFrame * count, 'idle')).toBe(0)
    expect(frameIndexAt(msPerFrame * (count + 1), 'idle')).toBe(1)
  })

  it('상태마다 독립적으로 프레임 수를 참조한다', () => {
    // frameCount가 0인 미지의 상태가 들어와도 예외 없이 0을 반환해야 한다.
    expect(frameIndexAt(1000, 'unknown-state' as never)).toBe(0)
  })
})

describe('spriteKey (상태+프레임 -> sprites/{state}_{n}.png 파일명 stem)', () => {
  it('상태와 프레임 번호를 언더스코어로 연결한다', () => {
    expect(spriteKey('worried', 2)).toBe('worried_2')
    expect(spriteKey('alarmed', 0)).toBe('alarmed_0')
  })
})
