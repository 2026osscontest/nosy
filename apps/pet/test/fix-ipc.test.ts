// fix 실행 IPC 배선 테스트. docs/specs/toggle-panel-spec.md FR-002~006, docs/ADR.md ADR-008 참조.
//
// Electron은 mock하고 파일시스템은 FakeHost로 대체한다 — 이 테스트는 "renderer의 findingId 하나가
// core의 fix 엔진까지 어떻게 이어지는가"만 본다. 안전장치 자체(sudo 거부·expectedLine 대조·백업 선행)는
// packages/core/test/fix.test.ts가 검증한다. main은 그 판정을 그대로 통과시켜야 하며 다시 구현하지 않는다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { FakeHost } from '@nosy/core'
import type { Finding, Snapshot, SnapshotStore } from '@nosy/core'
import { CHANNEL } from '../shared/ipc'
import type { FixResult, PetSnapshot } from '../shared/ipc'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  mainOn: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), send: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  ipcMain: { handle: mocks.handle, on: mocks.mainOn }
}))

const HOME = '/Users/fixture'
const RC = `${HOME}/.zshrc`

/**
 * 1행: PATH 중복 → warn. fix.edit이 없다 = "자동 수정 불가" 경로의 재료.
 * 2행: 없는 파일 source → error + fix.edit(줄 삭제). 실제로 적용해 볼 수 있는 유일한 종류다.
 * 3행: 삭제가 2행만 정확히 지웠는지 확인할 대조군.
 */
const RC_CONTENT = [
  'export PATH="/opt/bin:/opt/bin:$PATH"',
  'source /nowhere/missing.sh',
  'export EDITOR=vim',
  ''
].join('\n')

function memoryStore(): SnapshotStore & { saveCount: number } {
  let current: Snapshot = {}
  let saveCount = 0

  return {
    get saveCount() {
      return saveCount
    },
    async load() {
      return current
    },
    async save(snapshot: Snapshot) {
      current = snapshot
      saveCount += 1
    }
  }
}

interface SentMessage {
  channel: string
  payload: PetSnapshot
}

function fakeWindow(sent: SentMessage[]) {
  return {
    webContents: {
      send: (channel: string, payload: PetSnapshot) => sent.push({ channel, payload })
    },
    setIgnoreMouseEvents: vi.fn(),
    // 핸들러 등록 시점에 펫의 자리를 창에서 읽는다 (main/ipc.ts home).
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 104, height: 88 })),
    setBounds: vi.fn(),
    isDestroyed: () => false
  } as unknown as BrowserWindow
}

async function register() {
  vi.resetModules()
  const sent: SentMessage[] = []
  const window = fakeWindow(sent)
  const host = new FakeHost({ homedir: HOME, files: { [RC]: RC_CONTENT } })
  const store = memoryStore()
  const { registerIpcHandlers } = await import('../main/ipc')

  registerIpcHandlers(window, { host, store })

  const invoke = (channel: string, arg: unknown): Promise<FixResult> => {
    const handler = mocks.handle.mock.calls.find((call) => call[0] === channel)?.[1] as
      | ((event: unknown, arg: unknown) => Promise<FixResult>)
      | undefined

    if (!handler) throw new Error(`핸들러가 등록되지 않았다: ${channel}`)
    return handler({}, arg)
  }

  const runDiagnostics = async (): Promise<void> => {
    const handler = mocks.mainOn.mock.calls.find((call) => call[0] === CHANNEL.run)?.[1] as
      | ((event: unknown, scope: string) => Promise<void>)
      | undefined

    await handler?.({}, 'all')
  }

  const lastSnapshot = (): PetSnapshot => sent[sent.length - 1].payload

  const findings = (): Finding[] => lastSnapshot().results.flatMap((result) => result.findings)

  return { sent, host, store, invoke, runDiagnostics, lastSnapshot, findings }
}

/** 줄 삭제 fix가 붙은 항목 — 실제로 적용해 볼 수 있는 유일한 종류다. */
function editable(findings: Finding[]): Finding {
  const found = findings.find((finding) => finding.adapter === 'shell-rc' && finding.fix.edit)

  if (!found) throw new Error(`fix.edit이 붙은 finding이 없다: ${JSON.stringify(findings)}`)
  return found
}

/** 자동 수정을 지원하지 않는 항목. */
function nonEditable(findings: Finding[]): Finding {
  const found = findings.find((finding) => finding.adapter === 'shell-rc' && !finding.fix.edit)

  if (!found) throw new Error(`fix.edit이 없는 finding이 없다: ${JSON.stringify(findings)}`)
  return found
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockClear()
})

describe('applyFix 채널', () => {
  it('진단 전에 부르면 core를 호출하지 않고 실패를 반환한다', async () => {
    const { invoke, host } = await register()

    const result = await invoke(CHANNEL.applyFix, 'shell-rc:없는:항목')

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    // 파일이 그대로여야 한다 — 조회 실패가 파일 접근으로 이어지면 안 된다.
    expect(await host.readFile(RC)).toBe(RC_CONTENT)
  })

  it('진단 결과에 없는 findingId면 실패를 반환하고 파일을 건드리지 않는다', async () => {
    const { invoke, runDiagnostics, host } = await register()
    await runDiagnostics()

    const result = await invoke(CHANNEL.applyFix, 'shell-rc:완전히:다른:id')

    expect(result.ok).toBe(false)
    expect(await host.readFile(RC)).toBe(RC_CONTENT)
  })

  it('줄 삭제형 fix를 적용하면 그 줄만 사라진다', async () => {
    const { invoke, runDiagnostics, host, findings } = await register()
    await runDiagnostics()

    const result = await invoke(CHANNEL.applyFix, editable(findings()).id)

    expect(result.ok).toBe(true)
    expect(await host.readFile(RC)).toBe(
      ['export PATH="/opt/bin:/opt/bin:$PATH"', 'export EDITOR=vim', ''].join('\n')
    )
  })

  // ADR-008 ②: 파일 수정은 반드시 백업 후에 한다. renderer는 이 경로를 되돌리기 근거로 쓴다.
  // 백업은 원본 옆이 아니라 앱 디렉터리에 모인다 — 사용자의 홈을 어지르지 않는다.
  it('원본을 .bak 파일로 백업하고 그 경로를 돌려준다', async () => {
    const { invoke, runDiagnostics, host, findings } = await register()
    await runDiagnostics()

    const result = await invoke(CHANNEL.applyFix, editable(findings()).id)

    expect(result.backupPath).toBeTruthy()
    expect(result.backupPath).toContain(`${HOME}/.nosy/backups/.zshrc.bak.`)
    expect(await host.readFile(result.backupPath as string)).toBe(RC_CONTENT)
  })

  // toggle-panel-spec FR-002 ③: 실행 후 재진단해 결과를 반영한다.
  it('적용에 성공하면 재진단 결과를 state 채널로 밀어넣는다', async () => {
    const { invoke, runDiagnostics, sent, findings } = await register()
    await runDiagnostics()
    const before = sent.length

    await invoke(CHANNEL.applyFix, editable(findings()).id)

    expect(sent.length).toBeGreaterThan(before)
    expect(sent[sent.length - 1].channel).toBe(CHANNEL.state)
    expect(sent[sent.length - 1].payload.petState).not.toBe('thinking')
  })

  it('적용한 문제는 재진단 결과에서 사라지고 점수가 오른다', async () => {
    const { invoke, runDiagnostics, lastSnapshot, findings } = await register()
    await runDiagnostics()
    const target = editable(findings())
    const scoreBefore = lastSnapshot().score.score

    await invoke(CHANNEL.applyFix, target.id)

    expect(findings().map((finding) => finding.id)).not.toContain(target.id)
    expect(lastSnapshot().score.score).toBeGreaterThan(scoreBefore)
  })

  it('재진단 결과를 스냅샷에도 저장한다', async () => {
    const { invoke, runDiagnostics, store, findings } = await register()
    await runDiagnostics()
    const before = store.saveCount

    await invoke(CHANNEL.applyFix, editable(findings()).id)

    expect(store.saveCount).toBe(before + 1)
  })

  // core가 거부한 결과를 main이 성공으로 둔갑시키면 안 된다.
  it('자동 수정을 지원하지 않는 항목은 실패를 반환하고 파일을 그대로 둔다', async () => {
    const { invoke, runDiagnostics, host, findings } = await register()
    await runDiagnostics()

    const result = await invoke(CHANNEL.applyFix, nonEditable(findings()).id)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(await host.readFile(RC)).toBe(RC_CONTENT)
  })

  it('실패했을 때는 재진단하지 않는다', async () => {
    const { invoke, runDiagnostics, store, findings } = await register()
    await runDiagnostics()
    const before = store.saveCount

    await invoke(CHANNEL.applyFix, nonEditable(findings()).id)

    expect(store.saveCount).toBe(before)
  })
})

describe('revertFix 채널', () => {
  it('적용 기록이 없는 항목은 되돌릴 수 없다', async () => {
    const { invoke, runDiagnostics, host, findings } = await register()
    await runDiagnostics()

    const result = await invoke(CHANNEL.revertFix, editable(findings()).id)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(await host.readFile(RC)).toBe(RC_CONTENT)
  })

  // 이 테스트가 "backupPath만이 아니라 Finding 객체째 기억한다"는 설계의 근거다.
  // 적용에 성공하면 그 문제는 재진단 결과에서 사라지므로, 최신 결과에서만 finding을 찾는
  // 구현은 여기서 반드시 깨진다.
  it('적용 후 문제가 결과에서 사라져도 원본을 복원한다', async () => {
    const { invoke, runDiagnostics, host, findings } = await register()
    await runDiagnostics()
    const target = editable(findings())

    await invoke(CHANNEL.applyFix, target.id)
    expect(findings().map((finding) => finding.id)).not.toContain(target.id)

    const result = await invoke(CHANNEL.revertFix, target.id)

    expect(result.ok).toBe(true)
    expect(await host.readFile(RC)).toBe(RC_CONTENT)
  })

  it('되돌린 뒤 재진단하면 문제가 다시 잡힌다', async () => {
    const { invoke, runDiagnostics, findings } = await register()
    await runDiagnostics()
    const target = editable(findings())

    await invoke(CHANNEL.applyFix, target.id)
    await invoke(CHANNEL.revertFix, target.id)

    expect(findings().map((finding) => finding.id)).toContain(target.id)
  })

  it('한 번 되돌린 항목을 또 되돌리려 하면 실패한다', async () => {
    const { invoke, runDiagnostics, findings } = await register()
    await runDiagnostics()
    const target = editable(findings())

    await invoke(CHANNEL.applyFix, target.id)
    await invoke(CHANNEL.revertFix, target.id)
    const second = await invoke(CHANNEL.revertFix, target.id)

    expect(second.ok).toBe(false)
  })

  it('되돌리기에 성공하면 재진단 결과를 state 채널로 밀어넣는다', async () => {
    const { invoke, runDiagnostics, sent, findings } = await register()
    await runDiagnostics()
    const target = editable(findings())
    await invoke(CHANNEL.applyFix, target.id)
    const before = sent.length

    await invoke(CHANNEL.revertFix, target.id)

    expect(sent.length).toBeGreaterThan(before)
    expect(sent[sent.length - 1].channel).toBe(CHANNEL.state)
  })
})
