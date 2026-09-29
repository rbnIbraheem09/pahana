import { createRoot } from 'react-dom/client'
import '../fonts'
import '../styles/base.css'
import '../styles/components.css'
import './field.css'
import { App } from './App'
import { connect, useField } from './store'

document.documentElement.dataset.platform = window.pahana.platform
if (import.meta.env.DEV) Object.assign(window, { __field: useField })

connect().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
