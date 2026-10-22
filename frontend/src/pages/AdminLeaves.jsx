import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { API_BASE, apiFetch, apiFetchJson } from '../config'
import { formatAppointmentDate } from '../utils/date'

const statuses = ['all', 'pending', 'reviewing', 'approved', 'rejected', 'cancelled']

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [notes, setNotes] = useState({})
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [conflict, setConflict] = useState(null)
  const [checks, setChecks] = useState({})
  const [acknowledged, setAcknowledged] = useState({})

  const loadLeaves = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetchJson(`${API_BASE}/api/leaves`)
      if (!Array.isArray(data.leaves)) throw new Error('Unable to load leave requests.')
      setLeaves(data.leaves || [])
      setChecks({})
      setAcknowledged({})
    } catch (err) {
      setError(err.message || 'Unable to load leave requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLeaves()
  }, [])

  const checkAppointments = async leave => {
    setAcknowledged(previous => ({ ...previous, [leave._id]: false }))
    setChecks(previous => ({ ...previous, [leave._id]: { loading: true } }))
    try {
      const data = await apiFetchJson(`${API_BASE}/api/leaves/${leave._id}/conflicts`)
      if (!Array.isArray(data.conflicts) || !Number.isInteger(data.conflictCount)
        || !Number.isInteger(data.overlapLeaveCount) || typeof data.doctor?.active !== 'boolean'
        || typeof data.doctor?.verified !== 'boolean') throw new Error('Incomplete review response')
      setChecks(previous => ({ ...previous, [leave._id]: { data } }))
    } catch {
      setChecks(previous => ({ ...previous, [leave._id]: { error: 'We couldn’t check appointment conflicts. Please try again.' } }))
    }
  }

  const canApprove = leave => {
    const data = checks[leave._id]?.data
    return Boolean(data && data.conflictCount === 0 && data.overlapLeaveCount === 0
      && data.doctor.active && data.doctor.verified && acknowledged[leave._id])
  }

  const reviewLeave = async (leave, status) => {
    if (status === 'approved' && !canApprove(leave)) {
      setError('Check the appointment conflicts and confirm your review before approving leave.')
      return
    }
    setUpdating(leave._id)
    setError('')
    setNotice('')
    setConflict(null)
    try {
      const response = await apiFetch(`${API_BASE}/api/leaves/${leave._id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: notes[leave._id] || '' }),
      })
      const data = await response.json()
      if (response.status === 409) {
        setChecks(previous => ({ ...previous, [leave._id]: {} }))
        setAcknowledged(previous => ({ ...previous, [leave._id]: false }))
        setConflict({ leaveId: leave._id, message: data.message || 'Resolve the conflicting appointments before approving this leave.', appointments: data.conflicts || data.appointments || [], count: data.conflictCount })
        return
      }
      if (!response.ok) throw new Error(data.message || 'Unable to review this request.')
      setLeaves(previous => previous.map(item => item._id === leave._id ? { ...item, ...data.leave, status: data.leave?.status || status, adminNote: data.leave?.adminNote ?? (notes[leave._id] || '') } : item))
      setNotice(`Leave request ${status}.`)
    } catch (err) {
      setError(err.message || 'Unable to review this request.')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = leaves.filter(leave => filter === 'all' || leave.status === filter)
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col p-6 md:p-8 ml-0 lg:ml-64" id="admin-leaves">
        <div className="mb-6"><h1 className="text-3xl font-semibold text-navy">Doctor Leave Requests</h1><p className="mt-2 text-navy-muted">Approve or reject leave requests. Approved leave prevents new bookings for the requested dates.</p></div>
        <div className="flex flex-wrap gap-2 mb-6" aria-label="Leave status filters">{statuses.map(status => <button key={status} aria-pressed={filter === status} onClick={() => setFilter(status)} className={`px-4 py-2 rounded-xl border text-sm capitalize ${filter === status ? 'bg-primary text-white border-primary' : 'bg-white text-navy-muted border-outline-variant'}`}>{status} ({status === 'all' ? leaves.length : leaves.filter(leave => leave.status === status).length})</button>)}</div>
        {error && <div role="alert" className="p-4 mb-5 rounded-xl bg-red-50 text-red-700">{error} <button className="underline font-semibold" onClick={loadLeaves}>Reload requests</button></div>}
        {notice && <p role="status" className="p-4 mb-5 rounded-xl bg-green-50 text-green-700">{notice}</p>}
        {conflict && <div role="alert" className="p-5 mb-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900"><h2 className="font-semibold">Leave was not approved</h2><p className="mt-2">{conflict.message}</p>{(conflict.count !== undefined || conflict.appointments.length > 0) && <p className="mt-2">Conflicting appointments: {conflict.count ?? conflict.appointments.length}</p>}<ul className="my-3 space-y-1 text-sm">{conflict.appointments.map(appointment => <li key={appointment.id || appointment._id}>{formatAppointmentDate(appointment.date)} at {appointment.time}</li>)}</ul><Link className="underline font-semibold" to="/admin/appointments">View appointments to resolve booking conflicts</Link><p className="mt-2 text-sm">After resolving every conflict, return here and approve the request again.</p></div>}
        {loading ? <p role="status" className="p-12 text-center text-navy-muted">Loading leave requests...</p> : filtered.length === 0 ? <p className="p-12 text-center bg-white rounded-xl border border-outline-variant text-navy-muted">No leave requests found.</p> : <div className="space-y-5">{filtered.map(leave => <article key={leave._id} className="p-5 bg-white rounded-xl border border-outline-variant shadow-sm">
          <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold text-navy">{leave.doctor?.user?.name || leave.doctor?.name || 'Unavailable doctor'}</h2><p className="text-sm text-navy-muted">{leave.doctor?.specialty}</p><p className="text-sm text-navy-muted break-all">{leave.doctor?.user?.email}</p></div><span className="self-start text-sm font-semibold capitalize rounded-full px-3 py-1 bg-surface-container text-navy">{leave.status}</span></div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5 text-sm"><div><dt className="font-semibold text-navy">Leave dates (inclusive)</dt><dd className="text-navy-muted">{formatAppointmentDate(leave.startDate)} to {formatAppointmentDate(leave.endDate)}</dd></div><div><dt className="font-semibold text-navy">Requested</dt><dd className="text-navy-muted">{leave.createdAt ? new Date(leave.createdAt).toLocaleString() : '—'}</dd></div><div className="sm:col-span-2"><dt className="font-semibold text-navy">Reason</dt><dd className="text-navy-muted whitespace-pre-wrap break-words">{leave.reason}</dd></div>{leave.adminNote && <div className="sm:col-span-2"><dt className="font-semibold text-navy">Admin note</dt><dd className="text-navy-muted whitespace-pre-wrap break-words">{leave.adminNote}</dd></div>}</dl>
          {['pending', 'reviewing'].includes(leave.status) && <form onSubmit={event => { event.preventDefault(); reviewLeave(leave, 'approved') }} className="border-t border-outline-variant pt-4">
            {leave.status === 'reviewing' && <p className="text-sm text-amber-700 mb-3">A previous review is incomplete. You can retry the review to finish it.</p>}
            <div className="mb-5 rounded-xl bg-surface p-4">
              <button type="button" onClick={() => checkAppointments(leave)} disabled={updating !== null || checks[leave._id]?.loading} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">{checks[leave._id]?.loading ? 'Checking appointments…' : 'Check appointments'}</button>
              {checks[leave._id]?.error && <p role="alert" className="mt-3 text-sm text-error">{checks[leave._id].error}</p>}
              {checks[leave._id]?.data && <div className="mt-3 text-sm text-navy-muted">
                <p>Conflicting appointments: {checks[leave._id].data.conflictCount}</p>
                <p>Overlapping approved or reviewing leave: {checks[leave._id].data.overlapLeaveCount}</p>
                <p>Doctor account: {checks[leave._id].data.doctor.active && checks[leave._id].data.doctor.verified ? 'Active and verified' : 'Inactive or unverified'}</p>
                {checks[leave._id].data.processingCount > 0 && <p>Some bookings are still being processed. Check again shortly.</p>}
                <ul className="mt-2 space-y-1">{checks[leave._id].data.conflicts.map(appointment => <li key={appointment.id}>{appointment.patientName || 'Patient'} — {formatAppointmentDate(appointment.date)} at {appointment.time} ({appointment.status})</li>)}</ul>
                {checks[leave._id].data.conflictCount > 0 && <Link to="/admin/appointments" className="mt-2 inline-block font-semibold text-primary underline">Manage conflicting appointments</Link>}
                <p className="mt-3">Appointments are checked again when you approve.</p>
              </div>}
              <label className="mt-4 flex items-start gap-2 text-sm text-navy"><input type="checkbox" checked={Boolean(acknowledged[leave._id])} disabled={!checks[leave._id]?.data || updating !== null} onChange={event => setAcknowledged(previous => ({ ...previous, [leave._id]: event.target.checked }))} className="mt-1" />I have reviewed this application and its appointment conflicts.</label>
            </div>
            <label htmlFor={`admin-note-${leave._id}`} className="block text-sm font-semibold mb-2 text-navy">Admin note (optional)</label><textarea id={`admin-note-${leave._id}`} value={notes[leave._id] ?? ''} onChange={event => setNotes(previous => ({ ...previous, [leave._id]: event.target.value }))} maxLength={1000} rows={2} className="w-full p-3 border border-slate-300 rounded-lg text-sm" disabled={updating !== null} />
            <div className="flex flex-wrap gap-3 mt-3"><button type="submit" disabled={updating !== null || !canApprove(leave)} className="px-5 py-2 rounded-lg bg-primary text-white font-semibold text-sm disabled:opacity-50">{updating === leave._id ? 'Saving...' : 'Approve leave'}</button><button type="button" disabled={updating !== null} onClick={() => reviewLeave(leave, 'rejected')} className="px-5 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold text-sm disabled:opacity-50">Reject leave</button></div>
          </form>}
        </article>)}</div>}
        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8"><Footer /></div>
      </main>
    </div>
  )
}
