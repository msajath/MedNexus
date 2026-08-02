import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import Footer from '../components/Footer'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/appointments/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setAppointments(data.appointments || data || [])
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAppointments()
  }, [])

  const recentAppts = appointments.slice(0, 3)

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="patient-dashboard">
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Overview</h1>
            <h2 className="text-xl font-medium text-navy mt-2">Welcome back, {user?.name || 'Patient'}!</h2>
            <p className="text-base text-navy-muted mt-1">{loading ? 'Loading your appointments...' : appointments.length > 0 ? `You have ${appointments.length} appointment(s) scheduled.` : 'No appointments scheduled yet.'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon="calendar_today" value="12" label="Today's Appointments" color="var(--color-primary)" />
          <StatCard icon="people" value="1,284" label="Total Patients" color="var(--color-success)" />
          <StatCard icon="pending_actions" value="8" label="Pending Requests" color="var(--color-warning)" />
          <StatCard icon="favorite" value="98%" label="Health Score" color="#ec4899" />
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-semibold text-navy">Recent Appointments</h3>
            <Link to="/patient/appointments" className="px-4 py-2 text-sm font-semibold text-primary bg-transparent hover:bg-primary-fixed rounded-lg transition-colors">View All</Link>
          </div>
          <div className="flex flex-col gap-4">
            {recentAppts.map((appt) => (
              <div key={appt._id || appt.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 px-6 bg-white rounded-xl shadow-sm border border-outline-variant">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-sm">
                    {(appt.doctor?.name || appt.doctor || 'D').split(' ').slice(1).map(n => n[0]).join('') || 'D'}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-navy">{appt.doctor?.name || appt.doctor || 'N/A'}</h4>
                    <p className="text-sm font-medium text-outline">{appt.doctor?.specialty || appt.specialty || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <span className="flex items-center gap-1 text-sm text-navy-muted"><span className="material-icons-outlined text-[16px]">calendar_today</span>{appt.date}</span>
                  <span className="flex items-center gap-1 text-sm text-navy-muted"><span className="material-icons-outlined text-[16px]">schedule</span>{appt.time}</span>
                </div>
                <StatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
