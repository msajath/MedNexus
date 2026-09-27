import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { assets } from '../assets/assets'

const patientLinks = [
  { to: '/patient/appointments', icon: 'calendar_today', label: 'My Appointments' },
  { to: '/patient/records', icon: 'description', label: 'Medical Records' },
  { to: '/patient/messages', icon: 'mail', label: 'Messages' },
  { to: '/patient/profile', icon: 'settings', label: 'Settings' },
]

const doctorLinks = [
  { to: '/doctor/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/doctor/appointments', icon: 'calendar_today', label: 'My Appointments' },
  { to: '/doctor/availability', icon: 'schedule', label: 'Set Availability' },
  { to: '/doctor/messages', icon: 'mail', label: 'Messages' },
  { to: '/doctor/profile', icon: 'settings', label: 'Settings' },
]

const adminLinks = [
  { to: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/users', icon: 'group', label: 'Manage Users' },
  { to: '/admin/appointments', icon: 'calendar_today', label: 'All Appointments' },
  { to: '/admin/records', icon: 'description', label: 'Medical Records' },
  { to: '/admin/messages', icon: 'mail', label: 'Messages' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = user?.role === 'doctor' ? doctorLinks : user?.role === 'admin' ? adminLinks : patientLinks

  const handleLogout = () => {
    setMobileOpen(false)
    logout()
    navigate('/')
  }

  return (
    <>
      <button type="button" className="fixed top-4 left-4 z-[60] lg:hidden w-11 h-11 rounded-xl bg-white border border-outline-variant shadow-md flex items-center justify-center text-navy" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen}>
        <span className="material-icons-outlined">{mobileOpen ? 'close' : 'menu'}</span>
      </button>
      {mobileOpen && <button type="button" className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" />}
      <aside className={`fixed top-0 left-0 w-[260px] h-screen bg-gradient-to-b from-[#f0fdfa] via-[#ecfeff] to-[#f0f9ff] border-r border-outline-variant flex flex-col z-50 overflow-y-auto transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`} id="dashboard-sidebar">
      <div className="p-6 border-b border-outline-variant">
        <Link to="/" className="flex items-center">
          <img src={assets.logo} alt="MEDNEXUS Logo" className="w-36" />
        </Link>
      </div>

      {user && (
        <div className="p-5 px-6 flex items-center gap-3 border-b border-outline-variant">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <img src={assets.profile_pic} alt="Profile" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-navy">{user.name}</span>
            <span className="text-xs text-outline">{user.role === 'admin' ? 'System Admin' : user.role === 'doctor' ? 'Doctor' : 'Premium Member'}</span>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 px-3 flex flex-col gap-1">
        {links.map((link) => (
          <NavLink 
            key={link.label} 
            to={link.to} 
            className={({ isActive }) => `flex items-center gap-3 p-3 px-4 rounded-2xl text-sm transition-all w-full text-left relative ${isActive ? 'bg-[#0891b21f] text-primary font-semibold' : 'text-navy-muted font-medium hover:bg-[#0891b214] hover:text-primary'}`} 
            end
            onClick={(e) => {
              if (link.comingSoon) {
                e.preventDefault();
                alert(`${link.label} feature coming soon!`);
              } else {
                setMobileOpen(false)
              }
            }}
          >
            {({ isActive }) => (
              <>
                <span className="material-icons-outlined">{link.icon}</span>
                <span>{link.label}</span>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r"></span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 px-3 border-t border-outline-variant">
        <button className="flex items-center gap-3 p-3 px-4 rounded-2xl text-sm font-medium transition-all w-full text-left text-error hover:bg-error-bg" onClick={handleLogout}>
          <span className="material-icons-outlined">logout</span>
          <span>Logout</span>
        </button>
      </div>
      </aside>
    </>
  )
}
