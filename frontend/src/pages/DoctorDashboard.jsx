import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import Footer from '../components/Footer'
import { getLocalDateString } from '../utils/date'
import { API_BASE, apiFetchJson } from '../config'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    todayCount: 0,
    patientCount: 0,
    pendingCount: 0,
    totalEarnings: '—',
  })
  const [payouts, setPayouts] = useState([])
  const [payoutSummary, setPayoutSummary] = useState({
    totalPaidOut: 0,
    pendingBalance: 0,
  })
  const now = new Date()
  const [currentMonth] = useState(now.toLocaleString('default', { month: 'long', year: 'numeric' }))
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  const calendarOffset = (firstDayOfMonth + 6) % 7

  const fetchTodayAppointments = useCallback(() => {
    return Promise.all([
        apiFetchJson(`${API_BASE}/api/appointments/my`),
        apiFetchJson(`${API_BASE}/api/payments/my`),
      ]).then(([data, paymentData]) => {
      if (!Array.isArray(data?.appointments) || paymentData?.earnings?.basis !== 'recorded_payments'
        || !Number.isFinite(paymentData.earnings.netReceived)) throw new Error('Incomplete dashboard response')
      const appts = data.appointments
      const today = getLocalDateString()
      const todayList = appts.filter((appointment) => appointment.date === today)
      setAppointments(todayList.slice(0, 5))

      const patientIds = new Set(appts.map(a => a.patient?._id || a.patient).filter(Boolean))
      const pending = appts.filter(a => a.status === 'pending').length
      setStats({
        todayCount: todayList.length,
        patientCount: patientIds.size,
        pendingCount: pending,
        totalEarnings: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(paymentData.earnings.netReceived),
      })
      setPayouts(paymentData.payouts || [])
      setPayoutSummary({
        totalPaidOut: paymentData.totalPaidOut || 0,
        pendingBalance: paymentData.pendingBalance ?? (paymentData.earnings.netReceived || 0),
      })
      setError('')
    }).catch(() => {
      setError('We couldn’t load your dashboard. Please try again.')
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchTodayAppointments()
  }, [fetchTodayAppointments])

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="doctor-dashboard">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-semibold text-navy">Welcome back, {user?.name || 'Doctor'}!</h2>
            <p className="text-base text-navy-muted mt-1">{loading ? 'Loading today’s appointments…' : error ? 'Schedule data is unavailable.' : `You have ${stats.todayCount} appointments scheduled today.`}</p>
          </div>
          <Link to="/doctor/appointments" className="flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
            <span className="material-icons-outlined text-[18px]">calendar_today</span>Manage Calendar
          </Link>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl bg-error-bg p-4 text-error">{error} <button type="button" onClick={fetchTodayAppointments} className="ml-2 underline">Try again</button></div>}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
          <StatCard icon="calendar_today" value={loading || error ? '—' : stats.todayCount.toString()} label="Today's Appointments" color="var(--color-primary)" />
          <StatCard icon="people" value={loading || error ? '—' : stats.patientCount.toString()} label="Total Patients" color="var(--color-success)" />
          <StatCard icon="payments" value={loading || error ? '—' : stats.totalEarnings} label="Consultation Earnings" color="#8b5cf6" />
          <StatCard icon="account_balance" value={loading || error ? '—' : `$${payoutSummary.totalPaidOut.toFixed(2)}`} label="Transferred to Bank" color="#059669" />
        </div>

        {!loading && !error && (
          <div className="mb-6 p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-purple-900">
              <span className="material-icons-outlined text-[18px] text-purple-700">lock</span>
              <span><strong>Earnings Confidentiality:</strong> Your earnings are visible only to you and hospital administrators. Completed appointments auto-credit your income.</span>
            </div>
            <div className="shrink-0 flex items-center gap-2 font-semibold">
              <span className="text-navy-muted">Available for payout:</span>
              <span className="text-sm font-bold text-purple-800">${payoutSummary.pendingBalance.toFixed(2)} pending</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-8">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold text-navy">Today's Schedule</h3>
              <Link to="/doctor/appointments" className="px-4 py-2 text-sm font-semibold text-primary bg-transparent hover:bg-primary-fixed rounded-lg transition-colors">View Full Calendar</Link>
            </div>
            <div className="flex flex-col gap-3">
              {loading ? <p role="status" className="p-8 text-navy-muted">Loading schedule...</p> : error ? <p className="p-8 text-navy-muted">Schedule unavailable. Use Try again to reload.</p> : appointments.length > 0 ? (
                appointments.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 px-5 bg-white rounded-xl shadow-sm border border-outline-variant">
                    <div className="text-sm font-semibold text-primary min-w-20">{item.time || 'TBD'}</div>
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
                {Array.from({ length: calendarOffset }, (_, i) => (<span key={`empty-${i}`} className="text-center p-2 text-sm invisible"></span>))}
                {days.map((d) => (
                  <span key={d} className={`text-center p-2 text-sm rounded-lg cursor-pointer transition-colors relative ${d === now.getDate() ? 'bg-primary text-white font-semibold' : 'text-navy hover:bg-teal-50'}`}>{d}</span>
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

        {/* Bank Transfers & Salary Disbursements */}
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex items-center justify-between">
            <h3 className="text-lg font-semibold text-navy flex items-center gap-2">
              <span className="material-icons-outlined text-primary">account_balance</span>
              Bank Transfers &amp; Salary Received
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-surface rounded-full text-navy-muted">
              {payouts.length} Transfers
            </span>
          </div>
          {payouts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low text-xs uppercase text-navy-muted">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Bank &amp; Account</th>
                    <th className="p-3 text-left">Reference / Note</th>
                    <th className="p-3 text-right">Payout Amount</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p._id} className="border-t border-outline-variant hover:bg-surface/50">
                      <td className="p-3 text-xs">{new Date(p.processedAt || p.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-xs">
                        <span className="font-semibold block">{p.bankDetails?.bankName || 'Direct Bank'}</span>
                        <span className="text-navy-muted font-mono">{p.bankDetails?.accountNumber ? `••••${p.bankDetails.accountNumber.slice(-4)}` : 'Bank'}</span>
                      </td>
                      <td className="p-3 text-xs text-navy-muted">{p.notes || p.reference || 'Consultation Payout'}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">${Number(p.amount).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-navy-muted">
              No bank transfers recorded yet. Earned fees accumulate in your balance. Pending salary requests are not bank transfers.
            </div>
          )}
        </div>

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
