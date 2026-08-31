import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyPlatform } from './utils/platform'
import './shortcuts'
import './styles/application.sass'

applyPlatform()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
