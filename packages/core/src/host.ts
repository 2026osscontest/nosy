// DiagnosticHost 주입 인터페이스. docs/specs/core-types-spec.md FR-001~003 참조.
// 어댑터는 이 인터페이스만 통해 외부 상태에 접근하며, child_process/fs에 직접 접근하지 않는다.

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
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

const execFileAsync = promisify(execFile)

/** 실환경 구현. child_process/fs를 실제로 호출한다. */
export class NodeHost implements DiagnosticHost {
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
}

export interface FakeHostOptions {
  files?: Record<string, string>
  execResults?: Record<string, ExecResult>
  env?: NodeJS.ProcessEnv
  homedir?: string
}

/** 테스트 구현. test/fixtures/의 텍스트를 반환하며 실제 파일시스템에 접근하지 않는다. */
export class FakeHost implements DiagnosticHost {
  env: NodeJS.ProcessEnv
  homedir: string
  #files: Map<string, string>
  #execResults: Map<string, ExecResult>

  constructor(options: FakeHostOptions = {}) {
    this.#files = new Map(Object.entries(options.files ?? {}))
    this.#execResults = new Map(Object.entries(options.execResults ?? {}))
    this.env = options.env ?? {}
    this.homedir = options.homedir ?? '/Users/fixture'
  }

  async exec(cmd: string, args: string[]): Promise<ExecResult> {
    const key = [cmd, ...args].join(' ')
    return this.#execResults.get(key) ?? { stdout: '', stderr: '', code: 0 }
  }

  async readFile(path: string): Promise<string | null> {
    return this.#files.get(path) ?? null
  }
}
