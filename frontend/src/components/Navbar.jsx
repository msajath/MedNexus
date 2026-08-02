import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { assets } from '../assets/assets'
import { motion } from 'framer-motion'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const getDashboardLink = () => {
    if (!user) return '/login'
    if (user.role === 'doctor') return '/doctor/dashboard'
    if (user.role === 'admin') return '/admin/dashboard'
    return '/patient/appointments'
  }

  const getProfileLink = () => {
    if (!user) return '/login'
    if (user.role === 'doctor') return '/doctor/profile'
    if (user.role === 'admin') return '/admin/dashboard'
    return '/patient/profile'
  }

  const getAppointmentsLink = () => {
    if (!user) return '/login'
    if (user.role === 'doctor') return '/doctor/appointments'
    return '/patient/appointments'
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on route change
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDropdownOpen(false), 0)
    return () => window.clearTimeout(timeoutId)
  }, [location.pathname])

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
    navigate('/')
  }

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="sticky top-0 z-50 glass h-[72px]" 
      id="main-navbar"
    >
      <div className="max-w-[1280px] mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={assets.logo} alt="MEDNEXUS Logo" className="w-36" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/" className={`text-sm font-medium transition-colors relative pb-[24px] mb-[-24px] ${location.pathname === '/' ? 'text-primary' : 'text-navy-muted hover:text-primary'}`}>
            HOME
            {location.pathname === '/' && <motion.span layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-sm"></motion.span>}
          </Link>
          <Link to="/doctors" className={`text-sm font-medium transition-colors relative pb-[24px] mb-[-24px] ${location.pathname === '/doctors' ? 'text-primary' : 'text-navy-muted hover:text-primary'}`}>
            ALL DOCTORS
            {location.pathname === '/doctors' && <motion.span layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-sm"></motion.span>}
          </Link>
          <Link to="/about" className={`text-sm font-medium transition-colors relative pb-[24px] mb-[-24px] ${location.pathname === '/about' ? 'text-primary' : 'text-navy-muted hover:text-primary'}`}>
            ABOUT
            {location.pathname === '/about' && <motion.span layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-sm"></motion.span>}
          </Link>
          <Link to="/contact" className={`text-sm font-medium transition-colors relative pb-[24px] mb-[-24px] ${location.pathname === '/contact' ? 'text-primary' : 'text-navy-muted hover:text-primary'}`}>
            CONTACT
            {location.pathname === '/contact' && <motion.span layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-sm"></motion.span>}
          </Link>
          <Link to="/admin/dashboard" className="px-4 py-1 border-2 border-outline-variant rounded-full text-xs font-medium text-navy hover:bg-primary hover:text-white hover:border-primary transition-colors ml-2">Admin Panel</Link>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <div 
                className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center font-semibold text-sm cursor-pointer hover:scale-110 transition-transform select-none overflow-hidden"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <img src={assets.profile_pic} alt="Profile" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg border border-outline-variant overflow-hidden animate-fade-in z-[100]">
                  {/* User Info Header */}
                  <div className="px-5 py-4 border-b border-outline-variant bg-surface">
                    <p className="text-sm font-semibold text-navy truncate">{user.name}</p>
                    <p className="text-xs text-navy-muted truncate mt-0.5">{user.email}</p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <Link 
                      to={getProfileLink()} 
                      className="flex items-center gap-3 px-5 py-3 text-sm text-navy hover:bg-surface transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="material-icons-outlined text-[20px] text-navy-muted">person</span>
                      My Profile
                    </Link>
                    <Link 
                      to={getAppointmentsLink()} 
                      className="flex items-center gap-3 px-5 py-3 text-sm text-navy hover:bg-surface transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="material-icons-outlined text-[20px] text-navy-muted">calendar_today</span>
                      My Appointments
                    </Link>
                    <Link 
                      to={getDashboardLink()} 
                      className="flex items-center gap-3 px-5 py-3 text-sm text-navy hover:bg-surface transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="material-icons-outlined text-[20px] text-navy-muted">dashboard</span>
                      Dashboard
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-outline-variant py-2">
                    <button 
                      className="flex items-center gap-3 px-5 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors w-full text-left"
                      onClick={handleLogout}
                    >
                      <span className="material-icons-outlined text-[20px]">logout</span>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/register" className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark hover:-translate-y-[1px] hover:shadow-md transition-all">Create account</Link>
          )}
        </div>
      </div>
    </motion.nav>
  )
}

