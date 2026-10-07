import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assets } from '../assets/assets'
import { API_BASE } from '../config'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState('request')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSendResetCode = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset code')
      }

      setSuccess('If the email exists, a six-digit reset code has been sent. The code expires in 30 minutes.')
      setStep('reset')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetCode, newPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.errors?.[0]?.msg || 'Failed to reset password')

      setSuccess('Your password has been reset. You can now sign in.')
      setResetCode('')
      setNewPassword('')
      setConfirmPassword('')
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
            {step === 'request'
              ? 'Enter your registered email address and we will send a six-digit reset code.'
              : `Enter the reset code sent to ${email} and choose a new password.`}
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

          <form onSubmit={step === 'request' ? handleSendResetCode : handleResetPassword} className="flex flex-col gap-5">
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
                disabled={loading || step === 'reset'}
              />
            </div>

            {step === 'reset' && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy" htmlFor="reset-code">Reset Code</label>
                  <input type="text" id="reset-code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} required disabled={loading} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy" htmlFor="new-password">New Password</label>
                  <input type="password" id="new-password" minLength="6" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy" htmlFor="confirm-password">Confirm Password</label>
                  <input type="password" id="confirm-password" minLength="6" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Please wait...' : step === 'request' ? 'Send Reset Code' : 'Reset Password'}
            </button>
          </form>

          {step === 'reset' && (
            <button type="button" className="w-full mt-3 text-sm text-primary font-semibold hover:underline" onClick={() => { setStep('request'); setError(''); setSuccess('') }}>
              Use a different email
            </button>
          )}

          <p className="text-center text-sm text-navy-muted mb-8 mt-6">
            Remember your password? <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link>
          </p>
          <p className="text-center text-xs text-outline mb-4">© {new Date().getFullYear()} MEDNEXUS.</p>
        </div>
      </div>
    </div>
  )
}
