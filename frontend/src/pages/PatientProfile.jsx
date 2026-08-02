import { useState, useRef, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'

export default function PatientProfile() {
  const { user, setUser } = useAuth()
  
  const [formData, setFormData] = useState({
    firstName: '', 
    lastName: '', 
    email: '',
    phone: '', 
    dob: '', 
    gender: '',
    bloodType: '', 
    address: '',
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [profilePicture, setProfilePicture] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user) return

    const nameParts = (user.name || '').split(' ')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: user.email || '',
      phone: user.phone || '',
      dob: user.dob || '',
      gender: user.gender || 'Other',
      bloodType: user.bloodType || 'Unknown',
      address: user.address || ''
    })
    // Load existing avatar from user data
    if (user.avatar) {
      setProfilePicture(user.avatar)
    }
  }, [user])

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
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
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          dob: formData.dob,
          gender: formData.gender,
          bloodType: formData.bloodType,
          address: formData.address,
          avatar: profilePicture,
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setUser(data.user) // Update context with new user data
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="patient-profile">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">Patient Profile</h1>
          <p className="mt-2 text-base text-navy-muted">Update your personal information and security settings.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:text-left text-center gap-5 p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`
                )}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-navy">{formData.firstName} {formData.lastName}</h2>
                <p className="inline-block mt-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed text-xs font-semibold uppercase tracking-wider rounded-full">Premium Member</p>
              </div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button 
                className="sm:ml-auto px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors"
                onClick={() => fileInputRef.current.click()}
              >
                Change Photo
              </button>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h3 className="text-xl font-semibold text-navy mb-5">Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">First Name</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Last Name</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Email Address</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-surface-container focus:border-primary outline-none transition-colors" value={formData.email} disabled /><p className="text-xs text-outline mt-1">Email cannot be changed manually for security.</p></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Phone Number</label><input className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Date of Birth</label><input type="date" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.dob} onChange={(e) => handleChange('dob', e.target.value)} /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Gender</label><select className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.gender} onChange={(e) => handleChange('gender', e.target.value)}><option>Male</option><option>Female</option><option>Other</option></select></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium text-navy">Blood Type</label><select className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" value={formData.bloodType} onChange={(e) => handleChange('bloodType', e.target.value)}><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></div>
                <div className="flex flex-col gap-2 sm:col-span-2"><label className="text-sm font-medium text-navy">Address</label><textarea className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-white focus:border-primary outline-none transition-colors" rows="3" value={formData.address} onChange={(e) => handleChange('address', e.target.value)} /></div>
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
                <button className="px-5 py-2.5 text-navy font-semibold bg-transparent hover:bg-surface-container rounded-lg transition-colors">Cancel</button>
              </div>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h3 className="text-xl font-semibold text-navy mb-5">Security Settings</h3>
              <div className="flex justify-between items-center py-4 border-b border-surface-container-high"><div><h4 className="text-base font-semibold text-navy">Change Password</h4><p className="text-sm text-navy-muted">Update your password regularly for better security</p></div><button className="px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors">Update</button></div>
              <div className="flex justify-between items-center py-4"><div><h4 className="text-base font-semibold text-navy">Two-Factor Authentication</h4><p className="text-sm text-navy-muted">Add an extra layer of security to your account</p></div>
                <label className="relative inline-block w-12 h-[26px] cursor-pointer group">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="absolute inset-0 bg-surface-container-high rounded-full transition-all duration-300 peer-checked:bg-primary"></div>
                  <div className="absolute left-[3px] bottom-[3px] w-5 h-5 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-[22px]"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="p-6 bg-white rounded-xl shadow-sm border border-outline-variant text-center flex flex-col items-center gap-3">
              <span className="material-icons-outlined text-[32px] text-primary">support_agent</span>
              <h4 className="text-lg font-semibold text-navy">Need assistance?</h4>
              <p className="text-sm text-navy-muted">Our support team is available 24/7 to help with account settings.</p>
              <button className="mt-3 px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors">Contact Support</button>
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
