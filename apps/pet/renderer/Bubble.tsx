// 말풍선. 헬스 스코어 + 가장 심각한 문제 1건 요약. docs/specs/pet-window-spec.md FR-004 참조.

import { mostSevereFinding } from './summary'
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

  return (
    <div className="bubble">
      <div className="bubble-score">
        <span className="bubble-score-value">{snapshot.score.score}</span>
        <span className="bubble-score-grade">{snapshot.score.grade}</span>
      </div>

      {finding ? (
        <div className="bubble-body">
          <p className="bubble-title" data-severity={finding.severity}>
            {finding.title}
          </p>
          {finding.evidence && (
            <p className="bubble-evidence">
              {fileLabel(finding.evidence.file, finding.evidence.line)}
            </p>
          )}
        </div>
      ) : (
        <p className="bubble-body bubble-clear">문제를 찾지 못했습니다</p>
      )}
    </div>
  )
}
