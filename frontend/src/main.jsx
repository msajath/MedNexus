import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import App from './App.jsx'

const nativeFetch = window.fetch.bind(window)
localStorage.removeItem('token')
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {})
  headers.delete('Authorization')
  return nativeFetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
