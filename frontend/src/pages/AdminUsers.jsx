import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'

const roleColors = {
  patient: 'bg-blue-50 text-blue-700 border-blue-200',
  doctor: 'bg-green-50 text-green-700 border-green-200',
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deleting, setDeleting] = useState(null)

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchUsers()
  }, [])

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) return
    setDeleting(userId)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setUsers(prev => prev.filter(u => u._id !== userId))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(null)
    }
  }

  const handleVerifyDoctor = async (userId) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/admin/verify-doctor/${userId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, isVerified: true } : u))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const term = search.toLowerCase()
    const matchSearch = !search ||
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    return matchRole && matchSearch
  })

  const counts = {
    all: users.length,
    patient: users.filter(u => u.role === 'patient').length,
    doctor: users.filter(u => u.role === 'doctor').length,
    admin: users.filter(u => u.role === 'admin').length,
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="admin-users">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-navy">All Users</h1>
          <p className="mt-1 text-base text-navy-muted">Manage all registered patients, doctors, and admins.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Users', value: counts.all, icon: 'group', color: 'text-primary' },
            { label: 'Patients', value: counts.patient, icon: 'person', color: 'text-blue-600' },
            { label: 'Doctors', value: counts.doctor, icon: 'medical_services', color: 'text-green-600' },
            { label: 'Admins', value: counts.admin, icon: 'admin_panel_settings', color: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-outline-variant shadow-sm">
              <span className={`material-icons-outlined ${s.color} text-[28px]`}>{s.icon}</span>
              <div>
                <p className="text-2xl font-bold text-navy">{s.value}</p>
                <p className="text-xs text-navy-muted">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-slate-300 rounded-xl bg-white flex-1 max-w-md">
            <span className="material-icons-outlined text-outline text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="flex-1 border-none outline-none text-sm bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {Object.entries(counts).map(([key, count]) => (
              <button
                key={key}
                onClick={() => setRoleFilter(key)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${roleFilter === key ? 'bg-primary text-white border-primary' : 'bg-white text-navy-muted border-slate-200 hover:border-primary hover:text-primary'}`}
              >
                {key} ({count})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center p-12 text-navy-muted">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
            <span className="material-icons-outlined text-[48px] mb-2">group</span>
            <p>No users found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="text-left p-4 font-semibold text-navy-muted">User</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Role</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Status</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Joined</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u._id} className="border-b border-surface-container-high hover:bg-surface transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-navy">{u.name}</p>
                            <p className="text-xs text-navy-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${roleColors[u.role]}`}>{u.role}</span>
                      </td>
                      <td className="p-4">
                        {u.role === 'doctor' ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                            {u.isVerified ? '✓ Verified' : 'Pending'}
                          </span>
                        ) : (
                          <span className="text-xs text-navy-muted">—</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-navy-muted">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {u.role === 'doctor' && !u.isVerified && (
                            <button
                              onClick={() => handleVerifyDoctor(u._id)}
                              className="px-2.5 py-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors font-medium"
                            >
                              Verify
                            </button>
                          )}
                          {u.role !== 'admin' && (
                            <button
                              disabled={deleting === u._id}
                              onClick={() => handleDelete(u._id, u.name)}
                              className="px-2.5 py-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                            >
                              {deleting === u._id ? '...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-surface-container-high text-xs text-navy-muted">
              Showing {filtered.length} of {users.length} users
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
