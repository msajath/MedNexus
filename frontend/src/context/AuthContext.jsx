import { createContext, useContext, useState, useEffect } from 'react'
import { API_BASE, apiFetch, SESSION_EXPIRED_EVENT, getSessionRevision } from '../config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCurrentUser = async () => {
    const revision = getSessionRevision()
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/me`)
      if (revision !== getSessionRevision()) return
      if (response.ok) {
        const data = await response.json()
        if (revision !== getSessionRevision()) return
        setUser(data.user || data)
        setError(null)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    } finally {
      if (revision === getSessionRevision()) setLoading(false)
    }
  }

  useEffect(() => {
    const clearInvalidSession = () => { setUser(null); setError(null) }
    window.addEventListener(SESSION_EXPIRED_EVENT, clearInvalidSession)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentUser()
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearInvalidSession)
  }, [])

  const login = async (email, password) => {
    setError(null)
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Login failed')
      }

      const data = await response.json()
      const userData = data.user || data.data?.user

      if (userData) {
        setUser(userData)
        await fetchCurrentUser()
        return userData
      } else {
        throw new Error('No user received')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message)
      throw err
    }
  }

  const register = async (name, email, password, role, extras = {}) => {
    setError(null)
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, role, ...extras })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.errors?.[0]?.msg || 'Registration failed')
      }

      const data = await response.json()
      const userData = data.user

      if (userData) {
        setUser(userData)
        await fetchCurrentUser()
        return userData
      } else {
        throw new Error('No user received')
      }
    } catch (err) {
      console.error('Register error:', err)
      setError(err.message)
      throw err
    }
  }

  const logout = async () => {
    const response = await apiFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' })
    if (!response.ok && response.status !== 401) throw new Error('Logout failed. Please try again.')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, isAuthenticated: !!user, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
