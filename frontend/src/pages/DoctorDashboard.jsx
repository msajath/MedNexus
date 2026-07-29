import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import Footer from '../components/Footer'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const now = new Date()
  const [currentMonth] = useState(now.toLocaleString('default', { month: 'long', year: 'numeric' }))
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  useEffect(() => {
    fetchTodayAppointments()
  }, [])

  const fetchTodayAppointments = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/appointments/my', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        const appts = data.appointments || data || []
        setAppointments(appts.slice(0, 5)) // Show first 5
      }
    } catch (err) {
      console.error('Error fetching appointments:', err)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="doctor-dashboard">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-semibold text-navy">Welcome back, {user?.name || 'Doctor'}!</h2>
            <p className="text-base text-navy-muted mt-1">You have {appointments.length} appointments scheduled.</p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors" onClick={(e) => { e.preventDefault(); alert(`Viewing ${appointments.length} appointments...`); }}><span className="material-icons-outlined text-[18px]">calendar_today</span>Today's Appointments</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon="calendar_today" value="12" label="Today's Appointments" color="var(--color-primary)" trend={8} />
          <StatCard icon="people" value="1,284" label="Total Patients" color="var(--color-success)" trend={12} />
          <StatCard icon="pending_actions" value="8" label="Pending Requests" color="var(--color-warning)" trend={-3} />
          <StatCard icon="payments" value="$14,250" label="Total Earnings" color="#8b5cf6" trend={15} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-8">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold text-navy">Today's Schedule</h3>
              <Link to="/doctor/appointments" className="px-4 py-2 text-sm font-semibold text-primary bg-transparent hover:bg-primary-fixed rounded-lg transition-colors">View Full Calendar</Link>
            </div>
            <div className="flex flex-col gap-3">
              {appointments.length > 0 ? (
                appointments.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 px-5 bg-white rounded-xl shadow-sm border border-outline-variant">
                    <div className="text-sm font-semibold text-primary min-w-[80px]">{item.time || 'TBD'}</div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-navy">{item.patient?.name || 'Patient'}</h4>
                      <p className="text-xs text-outline mt-1">{item.type || 'Consultation'}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${item.status === 'confirmed' ? 'bg-green-100 text-green-700' : item.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending'}</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-outline-variant">
                  <p>No appointments scheduled</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="p-5 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h4 className="text-base font-semibold text-navy text-center mb-4">{currentMonth}</h4>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((d) => (<span key={d} className="text-center text-xs font-semibold text-outline p-1">{d}</span>))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[0, 0, 0].map((_, i) => (<span key={`empty-${i}`} className="text-center p-2 text-sm invisible"></span>))}
                {days.map((d) => (
                  <span key={d} className={`text-center p-2 text-sm rounded-lg cursor-pointer transition-colors relative ${d === 20 ? 'bg-primary text-white font-semibold' : 'text-navy hover:bg-teal-50'} ${[5, 12, 20, 25].includes(d) ? "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full " + (d === 20 ? "after:bg-white" : "after:bg-primary") : ""}`}>{d}</span>
                ))}
              </div>
            </div>

            <div className="p-6 text-center mt-4 bg-white rounded-xl shadow-sm border border-outline-variant">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-outlined text-[28px] text-primary">workspace_premium</span>
              </div>
              <h4 className="text-lg font-semibold text-navy mb-2">Premium Care</h4>
              <p className="text-sm text-navy-muted">Review your monthly performance and clinical insights to optimize patient satisfaction.</p>
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
