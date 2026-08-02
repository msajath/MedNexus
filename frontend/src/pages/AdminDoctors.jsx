import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showPassword, setShowPassword] = useState({}) // track which doctors have pw visible

  const fetchDoctors = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/admin/doctors-detail', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setDoctors(data.doctors || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctors()
  }, [])

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Delete Dr. ${name}? This cannot be undone.`)) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setDoctors(prev => prev.filter(d => d.userId !== userId))
        if (selected?.userId === userId) setSelected(null)
      }
    } catch (err) { console.error(err) }
  }

  const handleVerify = async (userId) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/admin/verify-doctor/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setDoctors(prev => prev.map(d => d.userId === userId ? { ...d, isVerified: true } : d))
        if (selected?.userId === userId) setSelected(prev => ({ ...prev, isVerified: true }))
      }
    } catch (err) { console.error(err) }
  }

  const copyToClipboard = (text) => navigator.clipboard.writeText(text)

  const toggleShowPassword = (doctorId) => {
    setShowPassword(prev => ({ ...prev, [doctorId]: !prev[doctorId] }))
  }

  const filtered = doctors.filter(d => {
    const term = search.toLowerCase()
    return !search ||
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.specialty?.toLowerCase().includes(term) ||
      d.location?.toLowerCase().includes(term)
  })

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="admin-doctors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Manage Doctors</h1>
            <p className="mt-1 text-base text-navy-muted">All doctor accounts with credentials and profile details.</p>
          </div>
          <div className="flex gap-2 text-sm font-semibold">
            <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-xl border border-green-200">
              {doctors.filter(d => d.isVerified).length} Verified
            </span>
            <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-200">
              {doctors.filter(d => !d.isVerified).length} Pending
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-slate-300 rounded-xl bg-white mb-6 max-w-md">
          <span className="material-icons-outlined text-outline text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search by name, email, specialty..."
            className="flex-1 border-none outline-none text-sm bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center p-12 text-navy-muted">Loading doctors...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1">
            {/* Doctor Cards */}
            <div className="flex flex-col gap-3">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
                  <span className="material-icons-outlined text-[48px] mb-2">medical_services</span>
                  <p>No doctors found</p>
                </div>
              ) : filtered.map(doc => (
                <div
                  key={doc._id}
                  onClick={() => setSelected(selected?._id === doc._id ? null : doc)}
                  className={`cursor-pointer p-5 bg-white rounded-xl border transition-all hover:shadow-md ${selected?._id === doc._id ? 'border-primary shadow-md' : 'border-outline-variant'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
                        {doc.avatar ? (
                          <img src={doc.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          doc.name?.split(' ').map(n => n[0]).join('').slice(0, 2)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-navy">{doc.name}</p>
                        <p className="text-sm text-navy-muted">{doc.specialty}</p>
                        <p className="text-xs text-outline mt-0.5">{doc.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${doc.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {doc.isVerified ? '✓ Verified' : 'Pending'}
                      </span>
                      {doc.credentialsChanged && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          Credentials Changed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Credentials row - always visible on card */}
                  <div className="mt-3 pt-3 border-t border-surface-container-high grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-outline uppercase tracking-wider font-semibold">Email</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-navy font-mono truncate">{doc.email}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(doc.email) }} className="text-outline hover:text-primary shrink-0">
                          <span className="material-icons-outlined text-[14px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-outline uppercase tracking-wider font-semibold">Initial Password</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-navy font-mono">
                          {doc.tempPassword
                            ? showPassword[doc._id] ? doc.tempPassword : '••••••••'
                            : doc.credentialsChanged ? <span className="text-blue-500 not-italic">Changed by doctor</span> : '—'
                          }
                        </span>
                        {doc.tempPassword && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); toggleShowPassword(doc._id) }} className="text-outline hover:text-primary shrink-0">
                              <span className="material-icons-outlined text-[14px]">{showPassword[doc._id] ? 'visibility_off' : 'visibility'}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(doc.tempPassword) }} className="text-outline hover:text-primary shrink-0">
                              <span className="material-icons-outlined text-[14px]">content_copy</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail Panel */}
            <div>
              {selected ? (
                <div className="sticky top-6 bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="p-5 border-b border-outline-variant bg-gradient-to-br from-primary/5 to-primary/10 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                      {selected.avatar ? (
                        <img src={selected.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selected.name?.split(' ').map(n => n[0]).join('').slice(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-navy text-lg truncate">{selected.name}</h3>
                      <p className="text-sm text-primary">{selected.specialty}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selected.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {selected.isVerified ? '✓ Verified' : '⏳ Pending Verification'}
                        </span>
                        {selected.available && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Available</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-4 text-sm overflow-y-auto max-h-[70vh]">
                    {/* Login Credentials */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span className="material-icons-outlined text-[16px]">key</span>
                        Login Credentials
                      </p>
                      <div className="flex flex-col gap-2.5">
                        <div>
                          <p className="text-xs text-amber-600 mb-1">Email Address</p>
                          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                            <span className="font-mono text-xs text-navy">{selected.email}</span>
                            <button onClick={() => copyToClipboard(selected.email)} className="text-amber-500 hover:text-amber-700 ml-2">
                              <span className="material-icons-outlined text-[16px]">content_copy</span>
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-amber-600 mb-1">Initial Password</p>
                          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                            <span className="font-mono text-xs text-navy">
                              {selected.tempPassword
                                ? showPassword[`detail_${selected._id}`] ? selected.tempPassword : '••••••••'
                                : selected.credentialsChanged
                                  ? 'Changed by doctor'
                                  : 'Not set'
                              }
                            </span>
                            {selected.tempPassword && (
                              <div className="flex gap-1 ml-2">
                                <button onClick={() => toggleShowPassword(`detail_${selected._id}`)} className="text-amber-500 hover:text-amber-700">
                                  <span className="material-icons-outlined text-[16px]">{showPassword[`detail_${selected._id}`] ? 'visibility_off' : 'visibility'}</span>
                                </button>
                                <button onClick={() => copyToClipboard(selected.tempPassword)} className="text-amber-500 hover:text-amber-700">
                                  <span className="material-icons-outlined text-[16px]">content_copy</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {selected.credentialsChanged && (
                          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                            ✓ Doctor has updated their own credentials
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Professional Info */}
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">Professional Info</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Specialty', value: selected.specialty },
                          { label: 'Consultation Fee', value: selected.fee ? `$${selected.fee}` : '—' },
                          { label: 'Experience', value: selected.experience || '—' },
                          { label: 'Location', value: selected.location || '—' },
                          { label: 'Rating', value: selected.rating ? `${selected.rating} ⭐` : '—' },
                          { label: 'Reviews', value: selected.reviews || '—' },
                        ].map(item => (
                          <div key={item.label} className="p-2.5 bg-surface rounded-lg border border-outline-variant">
                            <p className="text-xs text-outline mb-0.5">{item.label}</p>
                            <p className="font-semibold text-navy text-xs">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selected.bio && (
                      <div>
                        <p className="text-xs font-bold text-outline uppercase tracking-wider mb-1">Bio</p>
                        <p className="text-xs text-navy leading-relaxed">{selected.bio}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-1">Contact</p>
                      <div className="flex flex-col gap-1 text-xs text-navy">
                        {selected.phone && <p>📞 {selected.phone}</p>}
                        <p>📅 Joined: {selected.joinedDate ? new Date(selected.joinedDate).toLocaleDateString('en-GB') : '—'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
                      {!selected.isVerified && (
                        <button
                          onClick={() => handleVerify(selected.userId)}
                          className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
                        >
                          ✓ Verify Doctor Account
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(selected.userId, selected.name)}
                        className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors"
                      >
                        Delete Doctor Account
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-dashed border-slate-200 text-navy-muted">
                  <span className="material-icons-outlined text-[36px] mb-2">touch_app</span>
                  <p className="text-sm">Click a doctor to view full details</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
