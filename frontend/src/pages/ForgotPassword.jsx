import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assets } from '../assets/assets'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSendTemporaryPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send temporary password')
      }

      setSuccess('If the email exists, a temporary password has been sent to that inbox. Check your email and sign in with the temporary password.')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen" id="forgot-password-page">
      <div className="relative flex items-center justify-center p-8 md:p-12 overflow-hidden bg-linear-to-br from-teal-light via-accent-blue to-surface border-r border-outline-variant">
        {/* Background Decorative Circles */}
        <div className="absolute -top-25 -right-25 w-125 h-125 rounded-full bg-primary/5 pointer-events-none"></div>
        <div className="absolute -bottom-12.5 -left-12.5 w-75 h-75 rounded-full bg-primary/5 pointer-events-none"></div>

        <div className="relative z-10 text-navy w-full max-w-105">
          <Link to="/" className="flex items-center gap-3 mb-4">
            <img src={assets.logo} alt="MEDNEXUS Logo" className="w-48" />
          </Link>
          <p className="text-xl text-navy-muted mb-10">Secure password recovery.</p>
          <div className="hidden md:flex flex-col gap-4">
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">lock_reset</span> Fast & Secure Reset</div>
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">mark_email_read</span> Instant Email Link</div>
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">security</span> Advanced Account Protection</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 md:p-12 bg-surface-container-lowest">
        <div className="w-full max-w-105">
          <h2 className="text-3xl font-semibold text-navy mb-2">Forgot Password</h2>
          <p className="text-base text-navy-muted mb-8">
            Enter your registered email address and we will send a temporary password to that inbox.
          </p>

          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
              <span className="material-icons-outlined text-[18px]">error_outline</span>
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 mb-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <span className="material-icons-outlined text-[18px]">check_circle</span>
              {success}
            </div>
          )}

          <form onSubmit={handleSendTemporaryPassword} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-navy" htmlFor="reset-email">Email Address</label>
              <input
                type="email"
                id="reset-email"
                className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Temporary Password'}
            </button>
          </form>

          <p className="text-center text-sm text-navy-muted mb-8 mt-6">
            Remember your password? <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link>
          </p>
          <p className="text-center text-xs text-outline mb-4">© {new Date().getFullYear()} MEDNEXUS. Secure, HIPAA compliant platform.</p>
        </div>
      </div>
    </div>
  )
}