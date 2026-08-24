// 말풍선. 헬스 스코어 + 가장 심각한 문제 1건 요약. docs/specs/pet-window-spec.md FR-004 참조.
// 캐릭터가 픽셀 아트라 말풍선도 같은 문법을 쓴다 — 계단형 모서리, 하드 섀도, 도트 폰트.

import { mostSevereFinding, scoreBar } from './summary'
import type { PetSnapshot } from '../shared/ipc'

/** 전체 경로는 상세 패널의 몫이다. 말풍선에는 파일명:줄만 넣는다. */
function fileLabel(file: string, line: number): string {
  return `${file.slice(file.lastIndexOf('/') + 1)}:${line}`
}

interface BubbleProps {
  snapshot: PetSnapshot | null
}

export function Bubble({ snapshot }: BubbleProps) {
  if (!snapshot) return null

  const finding = mostSevereFinding(snapshot.results)
  const segments = scoreBar(snapshot.score.score, finding?.severity === 'error')

  return (
    <div className="bubble">
      <div className="bubble-frame">
        <div className="bubble-face">
          <div className="bubble-score">
            <span className="bubble-score-value">{snapshot.score.score}</span>
            <span className="bubble-score-grade" data-grade={snapshot.score.grade}>
              {snapshot.score.grade}
            </span>
          </div>

          <div className="bubble-bar">
            {segments.map((fill, index) => (
              <i key={index} data-fill={fill} />
            ))}
          </div>

          {finding ? (
            <>
              <p className="bubble-title">{finding.title}</p>
              {finding.evidence && (
                <p className="bubble-evidence">
                  {fileLabel(finding.evidence.file, finding.evidence.line)}
                </p>
              )}
            </>
          ) : (
            <p className="bubble-title">문제를 찾지 못했습니다</p>
          )}
        </div>
      </div>
    </div>
  )
}
