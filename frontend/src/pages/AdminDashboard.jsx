import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import Footer from '../components/Footer'
import { specialties } from '../data/mockData'
import { API_BASE, apiFetch } from '../config'
import { appointmentStatuses, formatMoney } from '../utils/admin'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [health, setHealth] = useState({ api: 'Checking', database: 'Checking', latency: null })
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalPatients: 0,
    monthlyAppointments: 0,
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [appointmentSummary, setAppointmentSummary] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [doctorEarnings, setDoctorEarnings] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [newDoctor, setNewDoctor] = useState({ name: '', email: '', specialty: 'General Practice', fee: 100 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [createdCredentials, setCreatedCredentials] = useState(null) // Store new doctor credentials

  const fetchAdminStats = async () => {
    setLoading(true)
    setError('')
    try {
      const started = performance.now()
      const [response, earningsResponse, activityResponse, ready] = await Promise.all([
        apiFetch(`${API_BASE}/api/admin/stats`),
        apiFetch(`${API_BASE}/api/admin/earnings`),
        apiFetch(`${API_BASE}/api/admin/recent-activity`),
        apiFetch(`${API_BASE}/api/ready`).catch(() => null),
      ])
      setHealth({ api: 'Reachable', database: ready?.ok ? 'Ready' : 'Unavailable', latency: Math.round(performance.now() - started) })
      if (!response.ok || !earningsResponse.ok || !activityResponse.ok) throw new Error('Unable to load dashboard data. Please try again.')
      const [data, earningsData, activityData] = await Promise.all([response.json(), earningsResponse.json(), activityResponse.json()])
      setStats(data.stats)
      setAppointmentSummary(data.appointmentSummary || null)
      setEarnings(earningsData.earnings || null)
      setDoctorEarnings(earningsData.doctors || [])
      setRecentActivity(activityData.activity || [])
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdminStats()
  }, [])

  const handleAddDoctor = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' },
        body: JSON.stringify(newDoctor)
      })
      const data = await response.json()
      if (response.status === 401) {
        localStorage.removeItem('token')
        setMessage({ type: 'error', text: 'Your admin session has expired. Please sign in again.' })
        setTimeout(() => { window.location.href = '/admin/login' }, 800)
        return
      }
      if (response.ok) {
        // Save credentials to show to admin
        setCreatedCredentials({ name: newDoctor.name, email: newDoctor.email })
        setShowAddDoctor(false)
        setNewDoctor({ name: '', email: '', specialty: 'General Practice', fee: 100 })
        setMessage({ type: '', text: '' })
        fetchAdminStats()
      } else {
        setMessage({ type: 'error', text: data.message || 'Error adding doctor' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), stats, appointmentSummary, earnings, doctorEarnings }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mednexus-report.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="admin-dashboard">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Admin Overview</h1>
            <p className="mt-2 text-base text-navy-muted">Appointments, doctor earnings, and leave approvals.</p>
          </div>
          <div className="flex gap-3">
            <button disabled={loading || Boolean(error)} className="flex items-center gap-2 px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors disabled:opacity-50" onClick={downloadReport}><span className="material-icons-outlined text-[18px]">download</span> Download Operations Report</button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors" onClick={() => setShowAddDoctor(true)}><span className="material-icons-outlined text-[18px]">person_add</span> Add Doctor</button>
          </div>
        </div>

        {/* Add Doctor Modal */}
        {showAddDoctor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-semibold text-navy">Add New Doctor</h2>
                <button onClick={() => setShowAddDoctor(false)} className="text-outline hover:text-navy"><span className="material-icons-outlined">close</span></button>
              </div>
              <form onSubmit={handleAddDoctor} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Name (include Dr.)</label>
                  <input type="text" required className="w-full p-2.5 border-[1.5px] border-slate-300 rounded-lg text-sm" value={newDoctor.name} onChange={(e) => setNewDoctor({...newDoctor, name: e.target.value})} placeholder="Dr. John Doe" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Email</label>
                  <input type="email" required className="w-full p-2.5 border-[1.5px] border-slate-300 rounded-lg text-sm" value={newDoctor.email} onChange={(e) => setNewDoctor({...newDoctor, email: e.target.value})} placeholder="doctor@example.com" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Specialty</label>
                  <select className="w-full p-2.5 border-[1.5px] border-slate-300 rounded-lg text-sm" value={newDoctor.specialty} onChange={(e) => setNewDoctor({...newDoctor, specialty: e.target.value})}>
                    {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Consultation Fee ($)</label>
                  <input type="number" required className="w-full p-2.5 border-[1.5px] border-slate-300 rounded-lg text-sm" value={newDoctor.fee} onChange={(e) => setNewDoctor({...newDoctor, fee: Number(e.target.value)})} />
                </div>
                
                {message.text && (
                  <div className={`p-3 rounded-lg text-sm mt-2 ${message.type === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'}`}>
                    {message.text}
                  </div>
                )}

                <button type="submit" disabled={isSubmitting} className="w-full mt-2 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Doctor Profile'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Credentials Display Modal - shown after doctor is created */}
        {createdCredentials && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <span className="material-icons-outlined text-green-600 text-[22px]">check_circle</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-navy">Doctor Created!</h2>
                  <p className="text-sm text-navy-muted">Ask the doctor to set their password</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 flex items-start gap-2">
                <span className="material-icons-outlined text-amber-600 text-[18px] mt-0.5 shrink-0">warning</span>
                <p className="text-xs text-amber-700">The doctor should open Forgot Password and set a private password using their email address.</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">Doctor Name</label>
                  <p className="text-navy font-semibold">{createdCredentials.name}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">Login Email</label>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-xl border border-outline-variant">
                    <span className="text-navy text-sm font-mono">{createdCredentials.email}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(createdCredentials.email); }}
                      className="text-primary hover:text-primary-dark"
                      title="Copy email"
                    >
                      <span className="material-icons-outlined text-[18px]">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="w-full mt-5 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
                onClick={() => setCreatedCredentials(null)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon="medical_services" value={loading || error ? '—' : stats.totalDoctors} label="Registered Doctors" color="var(--color-primary)" />
          <StatCard icon="groups" value={loading || error ? '—' : stats.totalPatients} label="Registered Patients" color="var(--color-success)" />
          <StatCard icon="calendar_month" value={loading || error ? '—' : stats.monthlyAppointments} label="Monthly Appointments" color="var(--color-warning)" />
          <StatCard icon="account_balance" value={loading || error ? '—' : formatMoney(earnings?.netReceived)} label="Net Received" color="#8b5cf6" />
        </div>

        {error && <div role="alert" className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl">{error} <button onClick={fetchAdminStats} className="underline font-semibold">Try again</button></div>}

        {!loading && !error && <>
          <section className="mb-8" aria-labelledby="appointment-summary-title">
            <div className="flex flex-wrap justify-between gap-3 mb-4"><h2 id="appointment-summary-title" className="text-xl font-semibold text-navy">Appointment Summary</h2><Link className="text-primary font-semibold" to="/admin/appointments">View all appointments</Link></div>
            {appointmentSummary ? <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{appointmentStatuses.map(status => <div key={status} className="p-4 bg-white rounded-xl border border-outline-variant"><p className="text-2xl font-semibold text-navy">{appointmentSummary[status] ?? 0}</p><p className="capitalize text-sm text-navy-muted">{status}</p></div>)}</div> : <p role="status">Appointment summary unavailable.</p>}
            <p className="text-xs text-navy-muted mt-3">Rescheduled counts appointments with a recorded date or time change. These appointments are also counted under their current status.</p>
          </section>
          <section className="mb-8 bg-white rounded-xl border border-outline-variant overflow-hidden" aria-labelledby="doctor-earnings-title">
            <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 id="doctor-earnings-title" className="text-xl font-semibold text-navy">Doctor Earnings &amp; Revenue</h2>
                <p className="text-sm text-navy-muted mt-1">Automatic consultation revenue credited upon appointment completion. Historical consultation fees do not count as payment without completed records.</p>
              </div>
              <Link to="/admin/doctors" className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors inline-flex items-center gap-1.5">
                <span className="material-icons-outlined text-[16px]">payments</span>
                Open Payout &amp; Salary Portal
              </Link>
            </div>
            <div className="p-5 pt-0"><div className="flex flex-wrap gap-5 text-sm mt-2"><p>Gross Revenue: <strong>{formatMoney(earnings?.receivedAmount)}</strong></p><p>Refunded: <strong>{formatMoney(earnings?.refundedAmount)}</strong></p><p>Net Revenue: <strong>{formatMoney(earnings?.netReceived)}</strong></p></div></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-container-low"><tr>{['Doctor', 'Specialty', 'Received', 'Refunded', 'Net Earned', 'Paid to Bank', 'Pending Balance', 'Action'].map(label => <th key={label} className="p-4 text-left">{label}</th>)}</tr></thead><tbody>{doctorEarnings.map(doctor => <tr key={doctor.doctorId} className="border-t border-outline-variant"><td className="p-4 font-semibold">{doctor.name || 'Unavailable doctor'}{doctor.isActive === false && <span className="text-xs font-normal block text-navy-muted">Inactive</span>}</td><td className="p-4">{doctor.specialty || '—'}</td><td className="p-4 font-semibold">{formatMoney(doctor.receivedAmount ?? doctor.netReceived)}</td><td className="p-4 text-navy-muted">{formatMoney(doctor.refundedAmount || 0)}</td><td className="p-4 font-semibold text-navy">{formatMoney(doctor.netReceived)}</td><td className="p-4 text-primary font-medium">{formatMoney(doctor.totalPaidOut || 0)}</td><td className="p-4 font-bold text-amber-800">{formatMoney(doctor.pendingBalance ?? doctor.netReceived ?? 0)}</td><td className="p-4"><Link to="/admin/doctors" className="text-primary hover:underline text-xs font-semibold">Pay / Manage</Link></td></tr>)}</tbody></table></div>
            {doctorEarnings.length === 0 && <p className="p-5 text-navy-muted">No doctors found.</p>}
          </section>
        </>}

        {loading ? (
          <div className="text-center p-8 text-navy-muted">
            <p>Loading dashboard data...</p>
          </div>
        ) : error ? null : (

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <div>
            <h3 className="text-xl font-semibold text-navy mb-5">Recent Activity</h3>
            <div className="flex flex-col bg-white rounded-xl shadow-sm border border-outline-variant py-2">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity._id || activity.id} className="flex gap-4 p-4 px-6 border-b border-surface-container-high last:border-b-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activity.type === 'registration' ? 'bg-blue-50 text-blue-600' : activity.type === 'booking' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                      <span className="material-icons-outlined text-[20px]">
                        {activity.type === 'registration' ? 'person_add' : activity.type === 'booking' ? 'calendar_today' : 'rate_review'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-navy">{activity.message}</p>
                      <span className="text-xs text-outline">{new Date(activity.time).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500">
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-navy mb-5">System Health</h3>
            <div className="flex flex-col gap-5 p-6 bg-white rounded-xl shadow-sm border border-outline-variant">
              <p className="text-sm text-navy-muted">API: <strong>{health.api}</strong></p>
              <p className="text-sm text-navy-muted">Database: <strong>{health.database}</strong></p>
              <p className="text-sm text-navy-muted">Health check latency: <strong>{health.latency === null ? 'Unavailable' : health.latency + ' ms'}</strong></p>
            </div>

            <div className="p-6 mt-5 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h4 className="text-lg font-semibold text-navy mb-2">Doctor Leave Requests</h4>
              <p className="text-sm text-navy-muted">Review requests and resolve appointment conflicts before approving leave.</p>
              <Link className="inline-block mt-3 text-primary font-semibold" to="/admin/leaves">Review leave requests</Link>
            </div>
            <div className="p-6 mt-5 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h4 className="text-lg font-semibold text-navy mb-2">Pending Doctor Approvals</h4>
              <p className="text-sm text-navy-muted">There are <strong>{stats.pendingApprovals || 0}</strong> new doctor profiles awaiting verification.</p>
              <button className="mt-3 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors" onClick={() => navigate('/admin/doctors')}>Review Now</button>
            </div>
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
