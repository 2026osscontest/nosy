import { createRoot } from 'react-dom/client'
import { PetView } from './PetView'

const container = document.getElementById('root')

if (container) {
  createRoot(container).render(<PetView state="idle" />)
}
