import { createRoot } from 'react-dom/client'
import '../fonts'
import '../styles/base.css'
import '../styles/components.css'
import './portal.css'
import { App } from './App'
import { boot, usePortal } from './store'

if (import.meta.env.DEV) Object.assign(window, { __portal: usePortal })

createRoot(document.getElementById('root')!).render(<App />)
void boot()
