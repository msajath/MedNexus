import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { assets } from '../assets/assets'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userData = await login(email, password)
      if (userData) {
        const userRole = userData.role
        if (userRole === 'doctor') navigate('/doctor/dashboard')
        else if (userRole === 'admin') navigate('/admin/dashboard')
        else navigate('/patient/appointments')
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen" id="login-page">
      <div className="relative flex items-center justify-center p-8 md:p-12 overflow-hidden bg-linear-to-br from-teal-light via-accent-blue to-surface border-r border-outline-variant">
        {/* Background Decorative Circles */}
        <div className="absolute -top-25 -right-25 w-125 h-125 rounded-full bg-primary/5 pointer-events-none"></div>
        <div className="absolute -bottom-12.5 -left-12.5 w-75 h-75 rounded-full bg-primary/5 pointer-events-none"></div>
        
        <div className="relative z-10 text-navy w-full max-w-105">
          <Link to="/" className="flex items-center gap-3 mb-4">
            <img src={assets.logo} alt="MEDNEXUS Logo" className="w-48" />
          </Link>
          <p className="text-xl text-navy-muted mb-10">Your health, managed with precision.</p>
          <div className="hidden md:flex flex-col gap-4">
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">check_circle</span> Instant Appointment Booking</div>
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">check_circle</span> Verified Specialists</div>
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">check_circle</span> HIPAA Compliant Platform</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 md:p-12 bg-surface-container-lowest">
        <div className="w-full max-w-105">
          <h2 className="text-3xl font-semibold text-navy mb-2">Welcome back</h2>
          <p className="text-base text-navy-muted mb-8">Sign in to your MEDNEXUS account</p>

          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-navy" htmlFor="email">Email Address</label>
              <input 
                type="email" 
                id="email" 
                className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" 
                placeholder="Enter your email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-navy" htmlFor="password">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  id="password" 
                  className="w-full p-3 pr-12 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" 
                  placeholder="Enter your password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button 
                  type="button" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-muted hover:text-navy transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <span className="material-icons-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mb-2">
              <label className="flex items-center gap-2 text-sm text-navy-muted cursor-pointer">
                <input type="checkbox" className="accent-primary" /> Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-primary font-medium hover:underline">Forgot Password?</Link>
            </div>
            <button 
              type="submit" 
              className="w-full py-3.5 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark transition-colors mb-2 disabled:bg-slate-400 disabled:cursor-not-allowed" 
              id="login-submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-sm text-navy-muted mb-8 mt-6">Don't have an account? <Link to="/register" className="text-primary font-semibold hover:underline">Register</Link></p>
          <p className="text-center text-xs text-outline mb-4">© {new Date().getFullYear()} MEDNEXUS. Secure, HIPAA compliant platform.</p>

          <div className="text-[0.85rem] text-slate-500 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <strong className="text-slate-700">Demo Accounts:</strong><br/>
            <span className="block mt-1">Patient: alex@mednexus.com / password123</span>
            <span className="block mt-1">Doctor: richard.james@mednexus.com / password123</span>
            <span className="block mt-1">Admin: admin@mednexus.com / password123</span>
          </div>
        </div>
      </div>
    </div>
  )
}
