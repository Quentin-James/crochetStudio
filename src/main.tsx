import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted variable fonts — bundled so the app has no network dependency.
import '@fontsource-variable/fraunces'
import '@fontsource-variable/inter'

import './design/tokens.css'
import './design/base.css'
import { App } from './app/App'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
