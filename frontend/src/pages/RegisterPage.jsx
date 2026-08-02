import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { assets } from '../assets/assets'

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState('patient')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { register } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userData = await register(
        `${firstName} ${lastName}`.trim(),
        email,
        password,
        role,
        role === 'doctor' ? { licenseNumber } : {}
      )

      if (userData) {
        if (role === 'doctor') navigate('/doctor/dashboard')
        else if (role === 'admin') navigate('/admin/dashboard')
        else navigate('/patient/appointments')
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen" id="register-page">
      <div className="relative flex items-center justify-center p-8 md:p-12 overflow-hidden bg-linear-to-br from-teal-light via-accent-blue to-surface border-r border-outline-variant">
        {/* Background Decorative Circles */}
        <div className="absolute -top-[100px] -right-[100px] w-[500px] h-[500px] rounded-full bg-primary/5 pointer-events-none"></div>
        <div className="absolute -bottom-[50px] -left-[50px] w-[300px] h-[300px] rounded-full bg-primary/5 pointer-events-none"></div>
        
        <div className="relative z-10 text-navy w-full max-w-[420px]">
          <Link to="/" className="flex items-center gap-3 mb-4">
            <img src={assets.logo} alt="MEDNEXUS Logo" className="w-48" />
          </Link>
          <p className="text-xl text-navy-muted mb-10">Join our network of healthcare excellence.</p>
          <div className="hidden md:flex flex-col gap-4">
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">how_to_reg</span> Quick & Easy Registration</div>
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">health_and_safety</span> Access Top Specialists</div>
            <div className="flex items-center gap-3 text-base text-navy"><span className="material-icons-outlined text-primary text-[20px]">history</span> Complete Medical History Tracking</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 md:p-12 bg-surface-container-lowest">
        <div className="w-full max-w-[480px]">
          <h2 className="text-3xl font-semibold text-navy mb-2">Create an Account</h2>
          <p className="text-base text-navy-muted mb-6">Sign up to get started with MEDNEXUS</p>

          <div className="flex gap-2 mb-6 p-1 bg-surface-container rounded-lg">
            {['patient', 'doctor'].map((r) => (
              <button key={r} type="button" className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-md text-sm font-medium transition-all ${role === r ? 'bg-white text-primary shadow-sm font-semibold' : 'bg-transparent text-navy-muted hover:text-navy'}`} onClick={() => setRole(r)}>
                <span className="material-icons-outlined text-[18px]">{r === 'patient' ? 'person' : 'medical_services'}</span>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-navy" htmlFor="firstName">First Name</label>
                <input type="text" id="firstName" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-navy" htmlFor="lastName">Last Name</label>
                <input type="text" id="lastName" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-navy" htmlFor="email">Email Address</label>
              <input type="email" id="email" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-navy" htmlFor="password">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} id="password" className="w-full p-3 pr-12 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
            
            {role === 'doctor' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-navy" htmlFor="license">Medical License Number</label>
                <input type="text" id="license" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="e.g. MD123456" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />
              </div>
            )}

            <div className="mb-2">
              <label className="flex items-center gap-2 text-sm text-navy-muted cursor-pointer">
                <input type="checkbox" required className="accent-primary" /> 
                <span>I agree to the <a href="#" className="text-primary font-medium hover:underline">Terms & Conditions</a></span>
              </label>
            </div>
            <button type="submit" className="w-full py-3.5 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark transition-colors mb-2 disabled:bg-slate-400 disabled:cursor-not-allowed" id="register-submit" disabled={loading}>{loading ? 'Creating Account...' : 'Create Account'}</button>
          </form>
          <p className="text-center text-sm text-navy-muted mb-8 mt-6">Already have an account? <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link></p>
          <p className="text-center text-xs text-outline mb-4">© {new Date().getFullYear()} MEDNEXUS. Secure, HIPAA compliant platform.</p>
        </div>
      </div>
    </div>
  )
}
