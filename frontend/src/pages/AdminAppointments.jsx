import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import AdminAppointmentPayment from '../components/AdminAppointmentPayment'
import { formatAppointmentDate } from '../utils/date'
import { appointmentStatuses, formatMoney, hasRescheduleHistory, summarizeAppointments } from '../utils/admin'
import { API_BASE, apiFetch } from '../config'

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
  const [statusFilter, setStatusFilter] = useState('total')
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshAppointments = useCallback(async () => {
    const res = await apiFetch(`${API_BASE}/api/admin/appointments`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Unable to load appointments.')
    setAppointments(data.appointments || [])
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await refreshAppointments()
    } catch (err) {
      setError(err.message || 'Unable to load appointments.')
    } finally {
      setLoading(false)
    }
  }, [refreshAppointments])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAppointments()
  }, [fetchAppointments])

  const updateStatus = async (id, status) => {
    setUpdating(id)
    setError('')
    setNotice('')
    try {
      const res = await apiFetch(`${API_BASE}/api/admin/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Unable to update the appointment.')
      setAppointments(prev => prev.map(appointment => appointment._id === id ? {
        ...appointment, status: data.appointment?.status || status,
        ...(Object.hasOwn(data.appointment || {}, 'paymentStatus') && { paymentStatus: data.appointment.paymentStatus }),
        ...(Object.hasOwn(data.appointment || {}, 'payment') && { payment: data.appointment.payment }),
      } : appointment))
      setNotice(`Appointment marked ${data.appointment?.status || status}.`)
    } catch (err) {
      setError(err.message || 'Unable to update the appointment.')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = appointments.filter(appointment => {
    const matchStatus = statusFilter === 'total' || (statusFilter === 'rescheduled' ? hasRescheduleHistory(appointment) : appointment.status === statusFilter)
    const term = search.trim().toLowerCase()
    const matchSearch = !term || [appointment._id, appointment.patient?.name, appointment.patient?.email, appointment.patient?.phone, appointment.doctor?.user?.name, appointment.doctor?.specialty, appointment.date, appointment.time, appointment.type].some(value => String(value || '').toLowerCase().includes(term))
    return matchStatus && matchSearch
  })
  const counts = summarizeAppointments(appointments)

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="admin-appointments">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">All Appointments</h1>
          <p className="mt-1 text-base text-navy-muted">Manage booking details, status, reschedule history, and automated revenue.</p>
          <p className="mt-2 text-sm text-navy-muted">Completed appointments automatically credit consultation fees to doctor earnings and hospital revenue. Admin can manage doctor payouts and bank salary transfers from Doctors &amp; Earnings.</p>
        </div>
        <div className="flex gap-2 flex-wrap mb-3" aria-label="Appointment status filters">
          {appointmentStatuses.map(status => <button key={status} onClick={() => setStatusFilter(status)} aria-pressed={statusFilter === status} className={`px-4 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${statusFilter === status ? 'bg-primary text-white border-primary' : 'bg-white text-navy-muted border-slate-200 hover:border-primary hover:text-primary'}`}>{status === 'total' ? 'All' : status} ({counts[status]})</button>)}
        </div>
        <p className="text-xs text-navy-muted mb-5">Rescheduled appointments are also counted under their current status. The rescheduled filter shows recorded date or time changes.</p>
        <div className="flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-slate-300 rounded-xl bg-white mb-5 max-w-md">
          <span aria-hidden="true" className="material-icons-outlined text-outline text-[20px]">search</span>
          <input aria-label="Search appointments" type="search" placeholder="Search patient, doctor, date, booking ID..." className="flex-1 min-w-0 border-none outline-none text-sm text-on-surface bg-transparent" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {error && <div role="alert" className="p-4 mb-5 rounded-xl bg-red-50 text-red-700">{error} <button onClick={fetchAppointments} className="underline font-semibold">Reload appointments</button></div>}
        {notice && <p role="status" className="p-4 mb-5 rounded-xl bg-green-50 text-green-700">{notice}</p>}
        {loading ? <p role="status" className="text-center p-12 text-navy-muted">Loading appointments...</p> : filtered.length === 0 ? (
          <div className="text-center py-20 text-navy-muted bg-white rounded-xl border border-dashed border-slate-300"><p>No appointments found</p></div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-surface-container-low border-b border-outline-variant">{['Patient', 'Doctor', 'Date & Time', 'Type & Fee', 'Status', 'Payment receipt', 'Actions'].map(label => <th key={label} className="text-left p-4 font-semibold text-navy-muted">{label}</th>)}</tr></thead>
                <tbody>{filtered.map(appointment => <tr key={appointment._id} className="border-b border-surface-container-high hover:bg-surface transition-colors">
                  <td className="p-4"><p className="font-semibold text-navy">{appointment.patient?.name || 'Unavailable patient'}</p><p className="text-xs text-navy-muted">{appointment.patient?.email}</p>{appointment.patient?.phone && <p className="text-xs text-navy-muted">{appointment.patient.phone}</p>}<p className="text-xs text-navy-muted mt-2 break-all">Booking ID: {appointment._id}</p></td>
                  <td className="p-4"><p className="font-medium text-navy">{appointment.doctor?.user?.name || 'Unavailable doctor'}</p><p className="text-xs text-navy-muted">{appointment.doctor?.specialty}</p></td>
                  <td className="p-4"><p className="text-navy">{formatAppointmentDate(appointment.date)}</p><p className="text-xs text-navy-muted">{appointment.time}</p>{appointment.createdAt && <p className="text-xs text-navy-muted mt-2">Booked: {new Date(appointment.createdAt).toLocaleString()}</p>}
                    {hasRescheduleHistory(appointment) && <details className="mt-3 min-w-48"><summary className="text-primary cursor-pointer text-xs font-semibold">Reschedule history ({appointment.rescheduleHistory?.length || 0})</summary><ol className="text-xs text-navy-muted mt-2 space-y-2">{appointment.rescheduleHistory?.map((change, index) => <li key={`${change.changedAt}-${index}`}><p>{formatAppointmentDate(change.fromDate)} {change.fromTime} → {formatAppointmentDate(change.toDate)} {change.toTime}</p>{change.changedAt && <p>Changed: {new Date(change.changedAt).toLocaleString()}</p>}</li>)}</ol></details>}
                  </td>
                  <td className="p-4"><p>{appointment.type}</p><p className="text-xs text-navy-muted mt-2">{formatMoney(appointment.feeAtBooking)}</p></td>
                  <td className="p-4"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusColors[appointment.status] || ''}`}>{appointment.status}</span>{hasRescheduleHistory(appointment) && <p className="text-xs text-primary mt-2">Rescheduled</p>}</td>
                  <td className="p-4 align-top"><AdminAppointmentPayment appointment={appointment} onRefresh={refreshAppointments} /></td>
                  <td className="p-4"><select aria-label={`Status for ${appointment.patient?.name || appointment._id}`} value={appointment.status} disabled={updating !== null || ['completed', 'cancelled'].includes(appointment.status)} onChange={event => updateStatus(appointment._id, event.target.value)} className="text-xs border border-slate-300 rounded-lg p-1.5 text-navy bg-white outline-none focus:border-primary cursor-pointer disabled:opacity-50"><option value="pending" disabled>Pending</option><option value="confirmed">Confirmed</option><option value="completed" disabled={appointment.status !== 'confirmed'}>Completed</option><option value="cancelled">Cancelled</option></select>{updating === appointment._id && <p className="text-xs mt-2">Saving...</p>}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <p className="p-4 border-t border-surface-container-high text-xs text-navy-muted">Showing {filtered.length} of {appointments.length} appointments</p>
          </div>
        )}
        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8"><Footer /></div>
      </main>
    </div>
  )
}
