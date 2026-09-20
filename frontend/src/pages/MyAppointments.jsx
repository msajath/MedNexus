import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import Footer from '../components/Footer'
import { formatAppointmentDate } from '../utils/date'

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([])
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const tabs = ['all', 'confirmed', 'pending', 'cancelled']
  const navigate = useNavigate()

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/appointments/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch appointments')
      const data = await response.json()
      setAppointments(data.appointments || data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching appointments:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAppointments()
  }, [])

  const handleCancel = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:5000/api/appointments/${apptId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        setAppointments(prev => prev.map(a =>
          (a._id || a.id) === apptId ? { ...a, status: 'cancelled' } : a
        ))
      } else {
        alert('Failed to cancel appointment')
      }
    } catch (err) {
      console.error('Cancel error:', err)
      alert('Error cancelling appointment')
    }
  }

  const filtered = tab === 'all' ? appointments : appointments.filter((a) => a.status === tab)

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="my-appointments">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">My Appointments</h1>
          <p className="mt-2 text-base text-navy-muted">Manage your upcoming and past consultations with healthcare professionals.</p>
        </div>

        <div className="flex gap-2 mb-6 border-b-2 border-surface-container-high pb-0">
          {tabs.map((t) => (
            <button 
              key={t} 
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all -mb-[2px] ${tab === t ? 'text-primary border-primary font-semibold' : 'text-navy-muted border-transparent hover:text-primary'}`} 
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'all' && `(${appointments.length})`}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center p-8">
            <p className="text-navy-muted">Loading appointments...</p>
          </div>
        )}

        {error && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="p-0 overflow-x-auto bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            {filtered.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Doctor</th>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Specialty</th>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Date</th>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Time</th>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Type</th>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Status</th>
                    <th className="p-4 px-5 text-left text-xs font-semibold uppercase tracking-wider text-outline border-b border-surface-container-high bg-surface-container-low">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((appt) => (
                    <tr key={appt._id || appt.id} className="hover:bg-accent-blue transition-colors">
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high">
                        <div className="flex items-center gap-3 font-semibold">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {appt.doctor?.name?.split(' ')?.slice(1)?.map(n => n[0])?.join('') || 'D'}
                          </div>
                          {appt.doctor?.name || appt.doctor || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high">{appt.doctor?.specialty || 'N/A'}</td>
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high">{formatAppointmentDate(appt.date)}</td>
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high">{appt.time || 'N/A'}</td>
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high">{appt.type || 'Consultation'}</td>
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high"><StatusBadge status={appt.status} /></td>
                      <td className="p-4 px-5 text-sm text-navy border-b border-surface-container-high">
                        <div className="flex gap-2">
                          {appt.status !== 'cancelled' && (
                            <>
                              <button
                                className="px-3 py-1.5 text-xs font-semibold text-primary bg-transparent hover:bg-primary-fixed rounded-lg transition-colors"
                                onClick={() => {
                                  const doctorId = appt.doctor?._id || appt.doctor?.id || appt.doctorId
                                  if (doctorId) navigate(`/doctors/${doctorId}`)
                                  else alert('Cannot reschedule: doctor info unavailable')
                                }}
                              >Reschedule</button>
                              <button
                                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-transparent hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => handleCancel(appt._id || appt.id)}
                              >Cancel</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <p>No appointments found</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
