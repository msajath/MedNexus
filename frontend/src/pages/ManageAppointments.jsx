import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import Footer from '../components/Footer'

export default function ManageAppointments() {
  const [appointments, setAppointments] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="manage-appointments">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">Manage Appointments</h1>
          <p className="mt-2 text-base text-navy-muted">Review and update your upcoming patient consultations.</p>
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
          <div className="flex flex-col gap-5">
            {appointments.length > 0 ? (
              appointments.map((appt) => (
                <div key={appt._id || appt.id} className="flex flex-col gap-4 p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {appt.patient?.name?.split(' ')?.map(n => n[0])?.join('') || 'P'}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-navy">{appt.patient?.name || 'Patient'}</h3>
                        <p className="text-xs font-medium tracking-wide uppercase text-outline mt-1">Age: {appt.patient?.age || 'N/A'} • {appt.type || 'Consultation'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-sm text-navy-muted">
                        <span className="material-icons-outlined text-[16px]">calendar_today</span>
                        {new Date(appt.date)?.toLocaleDateString() || appt.date} at {appt.time || 'N/A'}
                      </span>
                      <StatusBadge status={appt.status} />
                    </div>
                  </div>

                  <button className="flex items-center gap-1 w-max px-3 py-1.5 text-sm font-semibold text-primary bg-transparent hover:bg-primary-fixed rounded-lg transition-colors" onClick={() => setExpandedId(expandedId === appt._id ? null : appt._id)}>
                    <span className="material-icons-outlined text-[18px]">{expandedId === appt._id ? 'expand_less' : 'expand_more'}</span>
                    Full Clinical Notes
                  </button>

                  {expandedId === appt._id && (
                    <div className="p-4 bg-surface-container-low rounded-lg text-sm leading-relaxed text-navy-muted animate-fade-in">
                      <p>{appt.notes || 'No notes available'}</p>
                    </div>
                  )}

                  {appt.status !== 'cancelled' && (
                    <div className="flex gap-3 pt-3 border-t border-surface-container-high">
                      <button className="flex items-center gap-1 px-4 py-2 bg-success text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors">
                        <span className="material-icons-outlined text-[16px]">check</span> Complete
                      </button>
                      <button className="px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors">Reschedule</button>
                      <button className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors">Cancel</button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center p-8 text-slate-500">
                <p>No appointments to manage</p>
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
