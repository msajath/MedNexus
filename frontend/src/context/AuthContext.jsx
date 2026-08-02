import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCurrentUser = async (token) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user || data)
        setError(null)
      } else {
        localStorage.removeItem('token')
        setUser(null)
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  // Check if user is already logged in (token exists)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchCurrentUser(token)
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    setError(null)
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
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
      const token = data.token || data.data?.token
      const userData = data.user || data.data?.user

      if (token) {
        localStorage.setItem('token', token)
        setUser(userData)
        return userData
      } else {
        throw new Error('No token received')
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
      const response = await fetch('http://localhost:5000/api/auth/register', {
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
      const token = data.token
      const userData = data.user

      if (token) {
        localStorage.setItem('token', token)
        setUser(userData)
        return userData
      } else {
        throw new Error('No token received')
      }
    } catch (err) {
      console.error('Register error:', err)
      setError(err.message)
      throw err
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, isAuthenticated: !!user, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

