import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { BuilderErrorBoundary } from './builder/components/BuilderErrorBoundary'
import { initAnalytics } from './builder/analytics'
import './index.css'

initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BuilderErrorBoundary>
      <App />
    </BuilderErrorBoundary>
  </React.StrictMode>,
)
