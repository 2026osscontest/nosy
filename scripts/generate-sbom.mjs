// SBOM(CycloneDX 1.6) 생성기.
//
//   node scripts/generate-sbom.mjs
//
// cdxgen이 pnpm-lock.yaml에서 컴포넌트 그래프를 만들고, 그중 라이선스를 채우지 못한
// 항목을 `pnpm licenses list`의 결과로 메운다. cdxgen은 스코프 패키지(@babel/core 등)의
// 라이선스를 자주 비워 두는데, pnpm은 실제 설치된 패키지의 package.json을 읽으므로
// 두 소스를 합치면 커버리지가 올라간다.
//
// 출력: sbom.json

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'sbom.json')

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

console.log('cdxgen으로 컴포넌트 그래프를 만드는 중…')
run('npx', ['-y', '@cyclonedx/cdxgen@latest', '-t', 'pnpm', '-o', OUT, '--spec-version', '1.6'])

console.log('pnpm licenses로 라이선스를 보강하는 중…')
const licenseData = JSON.parse(run('pnpm', ['licenses', 'list', '--json']))

/** "@babel/core@7.29.7" → "MIT" 조회표. 버전 없는 키도 넣어 폴백으로 쓴다. */
const byName = new Map()
for (const [license, packages] of Object.entries(licenseData)) {
  for (const pkg of packages) {
    for (const version of pkg.versions ?? []) {
      byName.set(`${pkg.name}@${version}`, license)
    }
    if (!byName.has(pkg.name)) byName.set(pkg.name, license)
  }
}

const sbom = JSON.parse(fs.readFileSync(OUT, 'utf8'))

/** SPDX 표현식(괄호나 OR/AND가 든 것)은 expression으로, 단일 식별자는 license.id로 넣는다. */
function toLicenseEntry(license) {
  return /[()]|\s(OR|AND)\s/.test(license)
    ? [{ expression: license }]
    : [{ license: { id: license } }]
}

const fullNameOf = (c) => (c.group ? `${c.group}/${c.name}` : c.name)

let filled = 0
const unresolved = []

for (const component of sbom.components ?? []) {
  if (component.licenses?.length) continue

  const fullName = fullNameOf(component)
  const license = byName.get(`${fullName}@${component.version}`) ?? byName.get(fullName)

  if (!license) {
    unresolved.push(component)
    continue
  }

  component.licenses = toLicenseEntry(license)
  filled++
}

// 남은 것들은 대개 다른 플랫폼용 네이티브 바이너리(@esbuild/linux-x64 등)다.
// 이 머신에 설치되지 않아 pnpm이 모르므로 registry에서 직접 가져온다.
if (unresolved.length > 0) {
  console.log(`registry에서 ${unresolved.length}개를 조회하는 중…`)

  const CONCURRENCY = 8
  let cursor = 0
  let fromRegistry = 0

  async function worker() {
    while (cursor < unresolved.length) {
      const component = unresolved[cursor++]
      const spec = `${encodeURIComponent(fullNameOf(component))}/${component.version}`
      try {
        const response = await fetch(`https://registry.npmjs.org/${spec}`)
        if (!response.ok) continue
        const meta = await response.json()
        const license = typeof meta.license === 'string' ? meta.license : meta.license?.type
        if (!license) continue
        component.licenses = toLicenseEntry(license)
        fromRegistry++
      } catch {
        // 네트워크 실패는 조용히 넘긴다 — 미기재로 남을 뿐 SBOM 생성은 계속돼야 한다.
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  filled += fromRegistry
}

const stillMissing = (sbom.components ?? []).filter((c) => !c.licenses?.length).length

fs.writeFileSync(OUT, `${JSON.stringify(sbom, null, 2)}\n`)

const total = (sbom.components ?? []).length
console.log(`\n컴포넌트 ${total}개 · 보강 ${filled}개 · 미기재 ${stillMissing}개`)
console.log(`→ ${path.relative(ROOT, OUT)}`)
