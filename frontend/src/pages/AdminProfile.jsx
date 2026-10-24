import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import PasswordChangeForm from '../components/PasswordChangeForm'
import { API_BASE, apiFetch } from '../config'

export default function AdminProfile() {
  const { user, setUser } = useAuth()
  return user ? <AdminProfileForm key={user.id || user._id || user.email} user={user} setUser={setUser} /> : null
}

function AdminProfileForm({ user, setUser }) {
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [profilePicture, setProfilePicture] = useState(user.avatar || null)
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState(() => {
    const names = (user.name || '').split(' ')
    return { firstName: names[0] || '', lastName: names.slice(1).join(' ') || '', email: user.email || '', phone: user.phone || '' }
  })

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Choose a PNG, JPEG or WebP image up to 2 MB.' })
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePicture(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePhoto = () => {
    setProfilePicture(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleChange = (field, value) => setFormData({ ...formData, [field]: value })

  const handleSave = async () => {
    setIsSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          avatar: profilePicture,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setUser(data.user)
        setMessage({ type: 'success', text: 'Admin profile updated successfully!' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Error updating profile.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred while saving.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="admin-profile">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">Administrator Profile</h1>
          <p className="mt-2 text-base text-navy-muted">Manage your administrator account credentials, profile photo, and security details.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="flex flex-col gap-6">
            {/* Header / Avatar */}
            <div className="flex flex-col sm:flex-row items-center sm:text-left text-center gap-5 p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary to-primary-dark text-white flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden shadow-inner border border-white/20">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xl uppercase tracking-wider font-bold">
                    {formData.firstName ? `${formData.firstName.charAt(0)}${formData.lastName.charAt(0) || ''}` : <span className="material-icons-outlined text-[32px]">person</span>}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-navy">{formData.firstName} {formData.lastName || 'Administrator'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block px-3 py-0.5 bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider rounded-full">System Administrator</span>
                  {!profilePicture && <span className="text-xs text-navy-muted">(No photo uploaded yet)</span>}
                </div>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <div className="sm:ml-auto flex gap-2">
                <button 
                  type="button"
                  className="px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors flex items-center gap-1.5"
                  onClick={() => fileInputRef.current.click()}
                >
                  <span className="material-icons-outlined text-[16px]">photo_camera</span>
                  {profilePicture ? 'Change Photo' : 'Upload Photo'}
                </button>
                {profilePicture && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove Photo"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Account Details */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h3 className="text-xl font-semibold text-navy mb-5">Admin Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">First Name</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Last Name</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Email Address</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-surface-container focus:border-primary outline-none transition-colors" value={formData.email} disabled />
                  <p className="text-xs text-outline mt-1">Admin email cannot be modified directly.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Phone Number</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="e.g. +1 (555) 000-0000" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                </div>
              </div>

              {message.text && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 mt-6 pt-5 border-t border-surface-container-high">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className={`px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          {/* Right column: Security */}
          <div className="flex flex-col gap-6">
            <PasswordChangeForm />
          </div>
        </div>

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
