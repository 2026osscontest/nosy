// 상세 토글 패널. docs/specs/toggle-panel-spec.md, docs/ADR.md ADR-008 참조.
//
// 말풍선을 대체해서 열린다 — UI_GUIDE "클릭 → 말풍선 → 재클릭 → 상세 패널 확장"의 확장이
// 요약이 상세로 바뀌는 것이므로, 같은 프레임 문법(계단형 모서리·하드 섀도)에 점수 헤더를
// 유지해 "말풍선이 커진 것"으로 읽히게 한다.
//
// 안전장치는 여기서 새로 만들지 않는다. 실제 거부 판정은 packages/core/src/fix.ts가 하고,
// 이 화면은 그 판정을 미리 보여주고(비활성 토글) 실행 전 확인을 받는 역할만 한다.

import { useEffect, useRef, useState } from 'react'
import { fixability, panelItems, scoreBar } from './summary'
import type { AppliedRecord, PanelItem } from './summary'
import type { Finding } from '@nosy/core'
import type { PetSnapshot } from '../shared/ipc'

interface FixPanelProps {
  snapshot: PetSnapshot | null
}

interface Failure {
  id: string
  message: string
}

export function FixPanel({ snapshot }: FixPanelProps) {
  // main도 같은 기록을 들고 있지만 저쪽은 되돌리기 실행용이고, 이쪽은 화면에 남기기 위한 것이다.
  // 적용에 성공하면 그 문제는 재진단 결과에서 사라지므로 여기 없으면 행이 통째로 증발한다.
  const [applied, setApplied] = useState<Map<string, AppliedRecord>>(new Map())
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (!snapshot) return null

  const items = panelItems(snapshot.results, applied)
  const segments = scoreBar(snapshot.score.score, snapshot.results.some((result) =>
    result.findings.some((finding) => finding.severity === 'error')
  ))

  const apply = async (finding: Finding): Promise<void> => {
    setBusy(finding.id)
    setFailure(null)

    const result = await window.nosy.applyFix(finding.id)

    setBusy(null)
    setConfirming(null)

    if (result.ok && result.backupPath) {
      const backupPath = result.backupPath
      setApplied((prev) => new Map(prev).set(finding.id, { finding, backupPath, reverted: false }))
    } else {
      setFailure({ id: finding.id, message: result.error ?? '알 수 없는 이유로 실패했습니다.' })
    }
  }

  const revert = async (finding: Finding): Promise<void> => {
    setBusy(finding.id)
    setFailure(null)

    const result = await window.nosy.revertFix(finding.id)

    setBusy(null)

    if (result.ok) {
      // 기록을 지우지 않고 표시만 바꾼다 — 지우면 재진단 결과가 도착하기 전 한 프레임 동안
      // 이 항목이 어디에도 없어 행이 사라졌다 다시 나타난다 (summary.ts AppliedRecord 참조).
      setApplied((prev) => {
        const record = prev.get(finding.id)
        if (!record) return prev
        return new Map(prev).set(finding.id, { ...record, reverted: true })
      })
    } else {
      setFailure({ id: finding.id, message: result.error ?? '알 수 없는 이유로 실패했습니다.' })
    }
  }

  const copy = (finding: Finding): void => {
    const text = finding.fix.command ?? finding.fix.manual ?? ''

    // 프로덕션 빌드는 file:// 오리진이라 navigator.clipboard가 없을 수 있다.
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
    } else {
      legacyCopy(text)
    }

    setCopied(finding.id)
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="panel">
      <div className="panel-frame">
        <div className="panel-face">
          <div className="panel-head">
            <span className="panel-score">{snapshot.score.score}</span>
            <span className="panel-grade" data-grade={snapshot.score.grade}>
              {snapshot.score.grade}
            </span>
            <span className="panel-count">문제 {items.length}건</span>
          </div>

          <div className="panel-bar">
            {segments.map((fill, index) => (
              <i key={index} data-fill={fill} />
            ))}
          </div>

          {items.length === 0 ? (
            <p className="panel-empty">문제를 찾지 못했습니다</p>
          ) : (
            <ul className="panel-list">
              {items.map((item) => (
                <PanelRow
                  key={item.finding.id}
                  item={item}
                  confirming={confirming === item.finding.id}
                  busy={busy === item.finding.id}
                  copied={copied === item.finding.id}
                  failure={failure?.id === item.finding.id ? failure.message : undefined}
                  onRequest={() => setConfirming(item.finding.id)}
                  onCancel={() => setConfirming(null)}
                  onApply={() => void apply(item.finding)}
                  onRevert={() => void revert(item.finding)}
                  onCopy={() => copy(item.finding)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface PanelRowProps {
  item: PanelItem
  confirming: boolean
  busy: boolean
  copied: boolean
  failure?: string
  onRequest(): void
  onCancel(): void
  onApply(): void
  onRevert(): void
  onCopy(): void
}

function PanelRow({
  item,
  confirming,
  busy,
  copied,
  failure,
  onRequest,
  onCancel,
  onApply,
  onRevert,
  onCopy
}: PanelRowProps) {
  const { finding, backupPath } = item
  const mode = fixability(finding)
  const isApplied = backupPath !== undefined
  const confirmRef = useRef<HTMLDivElement>(null)

  // 확인 화면은 행 아래로 펼쳐지므로 목록이 길면 화면 밖에서 열린다. 사용자가 방금 누른
  // 토글의 결과를 찾아 스크롤하게 두지 않는다.
  useEffect(() => {
    if (confirming) confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [confirming])

  return (
    <li className="panel-row" data-severity={finding.severity} data-applied={isApplied}>
      <div className="panel-row-head">
        <span className="panel-dot" />
        <p className="panel-row-title">{finding.title}</p>

        {/* FR-005: needsSudo는 앱이 대신 실행하지 않는다. FR-001: v1은 줄 삭제형만 적용한다. */}
        <button
          type="button"
          className="panel-switch"
          data-on={isApplied}
          disabled={mode !== 'ready' || busy}
          aria-label={isApplied ? `${finding.title} 되돌리기` : `${finding.title} 고치기`}
          onClick={isApplied ? onRevert : onRequest}
        >
          <i />
        </button>
      </div>

      {finding.evidence && (
        <>
          <p className="panel-path">
            {finding.evidence.file}:{finding.evidence.line}
          </p>
          <p className="panel-excerpt">{finding.evidence.excerpt}</p>
        </>
      )}

      {mode !== 'ready' && !isApplied && (
        <>
          <p className="panel-note">
            {mode === 'sudo'
              ? '관리자 권한이 필요해 자동으로 실행하지 않습니다. 아래 명령을 복사해 직접 실행하세요.'
              : '자동 수정을 지원하지 않는 항목입니다. 아래 안내에 따라 직접 수정하세요.'}
          </p>
          <p className="panel-manual">{finding.fix.command ?? finding.fix.description}</p>
          {finding.fix.command && (
            <button type="button" className="panel-btn" onClick={onCopy}>
              {copied ? '복사했습니다' : '명령 복사'}
            </button>
          )}
        </>
      )}

      {/* FR-003: 토글을 켜면 곧바로 실행하지 않고 무엇을 하는지 보여주고 확인받는다. */}
      {confirming && !isApplied && finding.fix.edit && (
        <div className="panel-confirm" ref={confirmRef}>
          <p className="panel-confirm-title">아래 한 줄을 삭제합니다</p>
          <p className="panel-manual">
            {finding.fix.edit.file}:{finding.fix.edit.removeLine}
          </p>
          <p className="panel-excerpt">{finding.fix.edit.expectedLine}</p>
          {/* FR-004·FR-006: 백업이 곧 되돌리기 수단이므로 그 사실을 실행 전에 알린다. */}
          <p className="panel-note">
            원본은 {finding.fix.edit.file}.bak.〈시각〉으로 백업되며, 적용 후 이 패널에서 되돌릴 수
            있습니다.
          </p>
          <div className="panel-actions">
            <button type="button" className="panel-btn" data-kind="go" disabled={busy} onClick={onApply}>
              {busy ? '실행 중…' : '실행'}
            </button>
            <button type="button" className="panel-btn" disabled={busy} onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      )}

      {isApplied && (
        <p className="panel-note">
          적용했습니다. 원본은 {backupPath}에 있습니다. 토글을 다시 누르면 되돌립니다.
        </p>
      )}

      {failure && <p className="panel-error">{failure}</p>}
    </li>
  )
}

/** clipboard API가 없는 오리진용 폴백. */
function legacyCopy(text: string): void {
  const field = document.createElement('textarea')

  field.value = text
  document.body.appendChild(field)
  field.select()
  document.execCommand('copy')
  field.remove()
}
