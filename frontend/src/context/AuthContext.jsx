import { createContext, useContext, useState, useEffect } from 'react'
import { API_BASE } from '../config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`)
      if (response.ok) {
        const data = await response.json()
        setUser(data.user || data)
        setError(null)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCurrentUser()
  }, [])

  const login = async (email, password) => {
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
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
      const response = await fetch(`${API_BASE}/api/auth/register`, {
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
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' })
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
