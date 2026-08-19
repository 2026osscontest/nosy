import { defineConfig } from 'vitest/config'

// main/renderer 로직이 아직 없어 테스트가 비어 있다. 실제 테스트가 생기면 제거한다.
export default defineConfig({
  test: {
    passWithNoTests: true
  }
})
