import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PetView } from './PetView'
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

  // 첫 스냅샷이 오기 전까지는 idle. main이 곧 thinking을 밀어넣는다.
  return <PetView state={snapshot?.petState ?? 'idle'} />
}

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<App />)
}
