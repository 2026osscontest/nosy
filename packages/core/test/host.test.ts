import { describe, expect, it } from 'vitest'
import { FakeHost } from '../src/host.js'

describe('FakeHost', () => {
  it('returns fixture file contents for a registered path', async () => {
    const host = new FakeHost({
      files: { '/Users/fixture/.zshrc': 'export PATH=$PATH:/usr/local/bin\n' }
    })

    await expect(host.readFile('/Users/fixture/.zshrc')).resolves.toContain('export PATH')
  })

  it('returns null for a path with no fixture', async () => {
    const host = new FakeHost()

    await expect(host.readFile('/does/not/exist')).resolves.toBeNull()
  })

  it('returns a registered exec result without touching the real shell', async () => {
    const host = new FakeHost({
      execResults: {
        'brew doctor': { stdout: 'Your system is ready to brew.', stderr: '', code: 0 }
      }
    })

    await expect(host.exec('brew', ['doctor'])).resolves.toEqual({
      stdout: 'Your system is ready to brew.',
      stderr: '',
      code: 0
    })
  })

  it('returns an empty result for an unregistered exec call', async () => {
    const host = new FakeHost()

    await expect(host.exec('git', ['status'])).resolves.toEqual({ stdout: '', stderr: '', code: 0 })
  })
})
