import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'     // Phase 9 — design tokens (load FIRST, before other CSS)
import './index.css'
import './styles/mobile-ux.css'  // Phase 7 — mobile UX + 44px touch targets

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
