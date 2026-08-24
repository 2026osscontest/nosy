import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PetStage } from './PetStage'
import type { PetSnapshot } from '../shared/ipc'
import './index.css'

function App() {
  const [snapshot, setSnapshot] = useState<PetSnapshot | null>(null)

  useEffect(() => {
    // 구독을 먼저 걸고 나서 요청한다 — 순서가 뒤집히면 첫 결과를 놓칠 수 있다.
    const off = window.nosy.onState(setSnapshot)
    window.nosy.run('all')
    return off
  }, [])

  return <PetStage snapshot={snapshot} />
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<App />)
}
