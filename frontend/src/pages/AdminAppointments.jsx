import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { formatAppointmentDate } from '../utils/date'

const statusColors = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updating, setUpdating] = useState(null)

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/admin/appointments', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAppointments()
  }, [])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/admin/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        setAppointments(prev => prev.map(a => (a._id === id ? { ...a, status } : a)))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(null)
    }
  }

  const filtered = appointments.filter(a => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const term = search.toLowerCase()
    const matchSearch = !search ||
      a.patient?.name?.toLowerCase().includes(term) ||
      a.patient?.email?.toLowerCase().includes(term) ||
      a.doctor?.user?.name?.toLowerCase().includes(term) ||
      a.doctor?.specialty?.toLowerCase().includes(term)
    return matchStatus && matchSearch
  })

  const counts = {
    all: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="admin-appointments">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-navy">All Appointments</h1>
          <p className="mt-1 text-base text-navy-muted">Monitor and manage all appointments across the platform.</p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {Object.entries(counts).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${statusFilter === key ? 'bg-primary text-white border-primary' : 'bg-white text-navy-muted border-slate-200 hover:border-primary hover:text-primary'}`}
            >
              {key} ({count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-slate-300 rounded-xl bg-white mb-5 max-w-md">
          <span className="material-icons-outlined text-outline text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search by patient, doctor, specialty..."
            className="flex-1 border-none outline-none text-sm text-on-surface bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center p-12 text-navy-muted">Loading appointments...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
            <span className="material-icons-outlined text-[48px] mb-2">calendar_today</span>
            <p className="text-base">No appointments found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="text-left p-4 font-semibold text-navy-muted">Patient</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Doctor</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Date & Time</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Type</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Status</th>
                    <th className="text-left p-4 font-semibold text-navy-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(appt => (
                    <tr key={appt._id} className="border-b border-surface-container-high hover:bg-surface transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {appt.patient?.avatar ? (
                              <img src={appt.patient.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              appt.patient?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-navy">{appt.patient?.name || 'Unknown'}</p>
                            <p className="text-xs text-navy-muted">{appt.patient?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-navy">{appt.doctor?.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-navy-muted">{appt.doctor?.specialty}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-navy">{formatAppointmentDate(appt.date)}</p>
                        <p className="text-xs text-navy-muted">{appt.time}</p>
                      </td>
                      <td className="p-4">
                        <span className="text-xs bg-surface-container px-2 py-1 rounded">{appt.type}</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColors[appt.status] || ''}`}>
                          {appt.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <select
                          value={appt.status}
                          disabled={updating === appt._id}
                          onChange={(e) => updateStatus(appt._id, e.target.value)}
                          className="text-xs border border-slate-300 rounded-lg p-1.5 text-navy bg-white outline-none focus:border-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-surface-container-high text-xs text-navy-muted">
              Showing {filtered.length} of {appointments.length} appointments
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
