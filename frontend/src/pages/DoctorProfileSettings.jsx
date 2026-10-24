import { useState, useRef, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { specialties } from '../data/mockData'
import { API_BASE, apiFetch } from '../config'

export default function DoctorProfileSettings() {
  const { user, setUser } = useAuth()
  
  const [formData, setFormData] = useState({
    firstName: '', 
    lastName: '', 
    email: '',
    phone: '', 
    dob: '', 
    gender: 'Other',
    bloodType: 'Unknown', 
    address: '',
    // Doctor specific
    specialty: 'General Practice',
    fee: 100,
    experience: '1+ Years',
    location: '',
    bio: ''
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [profilePicture, setProfilePicture] = useState(null)
  const fileInputRef = useRef(null)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [emailPassword, setEmailPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!user) return

    const nameParts = (user.name || '').split(' ')
    // Handle "Dr." prefix
    let fName = nameParts[0] || ''
    let lName = nameParts.slice(1).join(' ') || ''
    if (fName === 'Dr.' && nameParts.length > 1) {
      fName = nameParts[0] + ' ' + nameParts[1]
      lName = nameParts.slice(2).join(' ') || ''
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      firstName: fName,
      lastName: lName,
      email: user.email || '',
      phone: user.phone || '',
      dob: user.dob || '',
      gender: user.gender || 'Other',
      bloodType: user.bloodType || 'Unknown',
      address: user.address || '',
      // Doctor specific
      specialty: user.doctorProfile?.specialty || 'General Practice',
      fee: user.doctorProfile?.fee ?? 100,
      experience: user.doctorProfile?.experience || '1+ Years',
      location: user.doctorProfile?.location || '',
      bio: user.doctorProfile?.bio || '',
      bankName: user.doctorProfile?.bankDetails?.bankName || '',
      accountNumber: user.doctorProfile?.bankDetails?.accountNumber || '',
      accountHolderName: user.doctorProfile?.bankDetails?.accountHolderName || user.name || '',
      routingNumber: user.doctorProfile?.bankDetails?.routingNumber || ''
    })
    setProfilePicture(user.avatar || null)
  }, [user])

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

  const handleChange = (field, value) => setFormData({ ...formData, [field]: value })

  const handleSave = async () => {
    setIsSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          dob: formData.dob,
          gender: formData.gender,
          bloodType: formData.bloodType,
          address: formData.address,
          email: formData.email,
          ...(formData.email !== user.email && { currentPassword: emailPassword }),
          avatar: profilePicture,
          specialty: formData.specialty,
          experience: formData.experience,
          location: formData.location,
          bio: formData.bio,
          bankDetails: {
            bankName: formData.bankName,
            accountNumber: formData.accountNumber,
            accountHolderName: formData.accountHolderName,
            routingNumber: formData.routingNumber,
          }
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setUser(data.user)
        setEmailPassword('')
        setMessage({ type: 'success', text: 'Profile updated successfully!' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Error updating profile.' })
      }
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'An error occurred while saving.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMessage({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    setPwSaving(true)
    setPwMessage({ type: '', text: '' })
    try {
      const res = await apiFetch(`${API_BASE}/api/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      })
      const data = await res.json()
      if (data.success) {
        setPwMessage({ type: 'success', text: 'Password updated successfully!' })
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => setPwMessage({ type: '', text: '' }), 3000)
      } else {
        setPwMessage({ type: 'error', text: data.message || data.errors?.[0]?.msg || 'Error updating password.' })
      }
    } catch {
      setPwMessage({ type: 'error', text: 'An error occurred.' })
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="doctor-profile-settings">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">Doctor Profile</h1>
          <p className="mt-2 text-base text-navy-muted">Update your personal and professional information.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col gap-6">
            
            {/* Header / Avatar */}
            <div className="flex flex-col sm:flex-row items-center sm:text-left text-center gap-5 p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`
                )}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-navy">{formData.firstName} {formData.lastName}</h2>
                <p className="inline-block mt-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider rounded-full">{formData.specialty}</p>
              </div>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button 
                className="sm:ml-auto px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors"
                onClick={() => fileInputRef.current.click()}
              >
                Change Photo
              </button>
            </div>

            {/* Professional Details */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h3 className="text-xl font-semibold text-navy mb-5">Professional Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Specialty</label>
                  <select className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.specialty} onChange={(e) => handleChange('specialty', e.target.value)}>
                    {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-navy">Consultation Fee (LKR / USD)</label>
                    <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="material-icons-outlined text-[12px]">lock</span> Fixed by Admin
                    </span>
                  </div>
                  <input type="number" disabled className="w-full p-3 border-[1.5px] border-slate-200 rounded-xl text-base text-navy-muted bg-slate-50 cursor-not-allowed outline-none font-semibold" value={formData.fee} />
                  <p className="text-xs text-outline">Fixed by Hospital Administrator from the Admin Panel. Visible on the home page and profile.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Experience</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="e.g. 10+ Years" value={formData.experience} onChange={(e) => handleChange('experience', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Clinic Location</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="e.g. New York, NY" value={formData.location} onChange={(e) => handleChange('location', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-sm font-medium text-navy">Professional Bio</label>
                  <textarea className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" rows="4" placeholder="Tell patients about your expertise..." value={formData.bio} onChange={(e) => handleChange('bio', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Bank Details for Payouts / Salary */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons-outlined text-primary text-[22px]">account_balance</span>
                <h3 className="text-xl font-semibold text-navy">Bank Details (For Salary & Payouts)</h3>
              </div>
              <p className="text-sm text-navy-muted mb-5">Provide your bank account details. The hospital administrator will transfer your earned consultation income and salary directly to this account.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Bank Name</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="e.g. Chase Bank, Bank of America" value={formData.bankName} onChange={(e) => handleChange('bankName', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Account Holder Name</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" placeholder="Full name on bank account" value={formData.accountHolderName} onChange={(e) => handleChange('accountHolderName', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Account Number</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors font-mono" placeholder="e.g. 1234567890" value={formData.accountNumber} onChange={(e) => handleChange('accountNumber', e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Routing / IFSC / Sort Code</label>
                  <input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors font-mono" placeholder="e.g. 021000021" value={formData.routingNumber} onChange={(e) => handleChange('routingNumber', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h3 className="text-xl font-semibold text-navy mb-5">Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">First Name</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Last Name</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Email Address</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} /><p className="text-xs text-primary mt-1">⚠ Changing this will update your login email.</p></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Phone Number</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} /></div>
                <div className="flex flex-col gap-2 sm:col-span-2"><label className="text-sm font-medium text-navy">Address</label><textarea className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" rows="2" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} /></div>
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

            {formData.email !== user?.email && <label className="flex flex-col gap-2 p-6 bg-white rounded-xl text-sm text-navy">Confirm your current password to change email<input type="password" autoComplete="current-password" value={emailPassword} onChange={event => setEmailPassword(event.target.value)} className="p-3 border border-slate-300 rounded-xl" /></label>}
            {/* Change Password */}
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h3 className="text-xl font-semibold text-navy mb-1">Change Password</h3>
              <p className="text-sm text-navy-muted mb-5">Use at least 10 characters. Avoid common passwords and your email; passphrases are welcome.</p>
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Current Password</label>
                  <input
                    type="password"
                    required
                    className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base focus:border-primary outline-none transition-colors"
                    placeholder="Enter current password"
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-navy">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={10}
                      maxLength={72}
                      className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base focus:border-primary outline-none transition-colors"
                      placeholder="At least 10 characters"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-navy">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      minLength={10}
                      maxLength={72}
                      className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base focus:border-primary outline-none transition-colors"
                      placeholder="Repeat new password"
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
                {pwMessage.text && (
                  <div className={`p-3 rounded-lg text-sm ${pwMessage.type === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                    {pwMessage.text}
                  </div>
                )}
                <div className="pt-2 border-t border-surface-container-high">
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-70"
                  >
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

          </div>

          <div className="flex flex-col gap-5">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant text-center flex flex-col items-center gap-3">
              <span className="material-icons-outlined text-[32px] text-primary">verified</span>
              <h4 className="text-lg font-semibold text-navy">Verified Profile</h4>
              <p className="text-sm text-navy-muted">Your profile is visible to all patients. Make sure your details are up to date.</p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
