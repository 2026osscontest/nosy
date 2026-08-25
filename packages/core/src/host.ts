// DiagnosticHost 주입 인터페이스. docs/specs/core-types-spec.md FR-001~003 참조.
// 어댑터는 이 인터페이스만 통해 외부 상태에 접근하며, child_process/fs에 직접 접근하지 않는다.

import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import { promisify } from 'node:util'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

export interface DiagnosticHost {
  exec(cmd: string, args: string[]): Promise<ExecResult>
  readFile(path: string): Promise<string | null>
  env: NodeJS.ProcessEnv
  homedir: string
}

/**
 * 쓰기 능력을 가진 호스트. fix 실행 엔진만 이 인터페이스를 받는다.
 * 어댑터에는 `DiagnosticHost`만 주입해 쓰기 능력 자체를 볼 수 없게 한다
 * (AGENTS.md "아키텍처 규칙" CRITICAL).
 */
export interface FixHost extends DiagnosticHost {
  writeFile(path: string, content: string): Promise<void>
  copyFile(from: string, to: string): Promise<void>
  /** 파일을 지운다. 없으면 아무것도 하지 않는다(예외를 던지지 않는다). */
  removeFile(path: string): Promise<void>
  /** 백업 파일명의 타임스탬프에 쓴다. 테스트가 고정할 수 있도록 주입한다. */
  now(): Date
}

const execFileAsync = promisify(execFile)

/** 실환경 구현. child_process/fs를 실제로 호출한다. */
export class NodeHost implements FixHost {
  env = process.env
  homedir = homedir()

  async exec(cmd: string, args: string[]): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args)
      return { stdout, stderr, code: 0 }
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number }
      return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.code ?? 1 }
    }
  }

  async readFile(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf-8')
    } catch {
      return null
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8')
  }

  /** 백업 디렉터리(`~/.nosy/backups`)는 아직 없을 수 있다 — NodeSnapshotStore와 같은 방식으로 보장한다. */
  async copyFile(from: string, to: string): Promise<void> {
    await mkdir(dirname(to), { recursive: true })
    await copyFile(from, to)
  }

  async removeFile(path: string): Promise<void> {
    await rm(path, { force: true })
  }

  now(): Date {
    return new Date()
  }
}

export interface FakeHostOptions {
  files?: Record<string, string>
  execResults?: Record<string, ExecResult>
  env?: NodeJS.ProcessEnv
  homedir?: string
  /** 주입하지 않으면 `new Date()`를 쓴다. 백업 파일명을 고정하고 싶을 때 넘긴다. */
  now?: Date
}

/** 테스트 구현. test/fixtures/의 텍스트를 반환하며 실제 파일시스템에 접근하지 않는다. */
export class FakeHost implements FixHost {
  env: NodeJS.ProcessEnv
  homedir: string
  #files: Map<string, string>
  #execResults: Map<string, ExecResult>
  #now?: Date

  constructor(options: FakeHostOptions = {}) {
    this.#files = new Map(Object.entries(options.files ?? {}))
    this.#execResults = new Map(Object.entries(options.execResults ?? {}))
    this.env = options.env ?? {}
    this.homedir = options.homedir ?? '/Users/fixture'
    this.#now = options.now
  }

  async exec(cmd: string, args: string[]): Promise<ExecResult> {
    const key = [cmd, ...args].join(' ')
    return this.#execResults.get(key) ?? { stdout: '', stderr: '', code: 0 }
  }

  async readFile(path: string): Promise<string | null> {
    return this.#files.get(path) ?? null
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.#files.set(path, content)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const content = this.#files.get(from)
    if (content === undefined) throw new Error(`FakeHost: 복사할 원본이 없습니다 — ${from}`)
    this.#files.set(to, content)
  }

  async removeFile(path: string): Promise<void> {
    this.#files.delete(path)
  }

  now(): Date {
    return this.#now ?? new Date()
  }
}
