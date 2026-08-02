import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import Footer from '../components/Footer'
import { specialties } from '../data/mockData'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalDoctors: 0,
    totalPatients: 0,
    monthlyAppointments: 0,
    revenue: '$0'
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [newDoctor, setNewDoctor] = useState({ name: '', email: '', password: '', specialty: 'General Practice', fee: 100 })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [createdCredentials, setCreatedCredentials] = useState(null) // Store new doctor credentials

  const fetchAdminStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || data || {
          totalDoctors: 0,
          totalPatients: 0,
          monthlyAppointments: 0,
          revenue: '$0'
        })
        setRecentActivity(data.recentActivity || [])
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err)
      // Set default values on error
      setStats({
        totalDoctors: 0,
        totalPatients: 0,
        monthlyAppointments: 0,
        revenue: '$0'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminStats()
  }, [])

  const handleAddDoctor = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage({ type: '', text: '' })
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/admin/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newDoctor)
      })
      const data = await response.json()
      if (response.ok) {
        // Save credentials to show to admin
        setCreatedCredentials({ name: newDoctor.name, email: newDoctor.email, password: newDoctor.password })
        setShowAddDoctor(false)
        setNewDoctor({ name: '', email: '', password: '', specialty: 'General Practice', fee: 100 })
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="admin-dashboard">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Admin Overview</h1>
            <p className="mt-2 text-base text-navy-muted">Platform performance and user activity.</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-outline text-navy text-sm font-semibold rounded-lg hover:bg-surface-container-lowest transition-colors" onClick={() => alert("Downloading report...")}><span className="material-icons-outlined text-[18px]">download</span> Download Report</button>
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
                  <label className="text-sm font-medium text-navy">Initial Password</label>
                  <input type="text" required className="w-full p-2.5 border-[1.5px] border-slate-300 rounded-lg text-sm" value={newDoctor.password} onChange={(e) => setNewDoctor({...newDoctor, password: e.target.value})} placeholder="password123" />
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
                  <p className="text-sm text-navy-muted">Share these credentials with the doctor</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 flex items-start gap-2">
                <span className="material-icons-outlined text-amber-600 text-[18px] mt-0.5 shrink-0">warning</span>
                <p className="text-xs text-amber-700">Save these credentials now. The doctor must use these to log in and should change their password after first login.</p>
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-outline uppercase tracking-wider">Initial Password</label>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-xl border border-outline-variant">
                    <span className="text-navy text-sm font-mono">{createdCredentials.password}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(createdCredentials.password); }}
                      className="text-primary hover:text-primary-dark"
                      title="Copy password"
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
                Done — I've Saved the Credentials
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon="medical_services" value={stats.totalDoctors} label="Registered Doctors" color="var(--color-primary)" trend={5} />
          <StatCard icon="groups" value={stats.totalPatients} label="Registered Patients" color="var(--color-success)" trend={12} />
          <StatCard icon="calendar_month" value={stats.monthlyAppointments} label="Monthly Appointments" color="var(--color-warning)" trend={8} />
          <StatCard icon="account_balance" value={stats.revenue} label="Total Revenue" color="#8b5cf6" trend={15} />
        </div>

        {loading ? (
          <div className="text-center p-8 text-navy-muted">
            <p>Loading dashboard data...</p>
          </div>
        ) : (

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
                      <span className="text-xs text-outline">{activity.time}</span>
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
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-navy-muted">Server Uptime</span>
                  <span className="text-sm font-semibold text-success">99.99%</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: '99.99%' }}></div></div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-navy-muted">API Response Time</span>
                  <span className="text-sm font-semibold text-navy">124ms</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: '30%' }}></div></div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-navy-muted">Database Load</span>
                  <span className="text-sm font-semibold text-warning">65%</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden"><div className="h-full bg-warning rounded-full" style={{ width: '65%' }}></div></div>
              </div>
            </div>

            <div className="p-6 mt-5 bg-white rounded-xl shadow-sm border border-outline-variant">
              <h4 className="text-lg font-semibold text-navy mb-2">Pending Doctor Approvals</h4>
              <p className="text-sm text-navy-muted">There are <strong>4</strong> new doctor profiles awaiting verification.</p>
              <button className="mt-3 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors" onClick={() => alert("Loading pending doctor approvals...")}>Review Now</button>
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
