import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { API_BASE, apiFetch, apiFetchJson } from '../config'
import { formatAppointmentDate, getLocalDateString } from '../utils/date'

const statusLabels = {
  pending: 'Pending approval', reviewing: 'Being reviewed', approved: 'Approved',
  rejected: 'Rejected', cancelled: 'Cancelled',
}
const statusClasses = {
  pending: 'bg-warning-bg text-warning', reviewing: 'bg-info-bg text-primary',
  approved: 'bg-success-bg text-success', rejected: 'bg-error-bg text-error',
  cancelled: 'bg-slate-100 text-slate-600',
}

export default function DoctorLeave() {
  const [leaves, setLeaves] = useState([])
  const [today, setToday] = useState(getLocalDateString)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [requestVersion, setRequestVersion] = useState(0)
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const data = await apiFetchJson(`${API_BASE}/api/leaves/my`, { signal: controller.signal })
        if (!Array.isArray(data.leaves)) throw new Error('Invalid leave response')
        if (controller.signal.aborted) return
        setLeaves(data.leaves)
        if (data.clinicDate) setToday(data.clinicDate)
        setLoadError('')
      } catch {
        if (!controller.signal.aborted) setLoadError('We couldn’t load your leave requests. Please try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [requestVersion])

  const reload = () => {
    setLoading(true)
    setLoadError('')
    setRequestVersion(value => value + 1)
  }

  const submit = async event => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (form.startDate < today || form.endDate < form.startDate) {
      setError('Choose a start date from today onward and an end date on or after it.')
      return
    }
    if (!form.reason.trim()) {
      setError('Please enter a reason for your leave request.')
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch(`${API_BASE}/api/leaves`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, reason: form.reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.errors?.[0]?.msg || 'Your leave request could not be submitted.')
      setLeaves(previous => [data.leave, ...previous])
      setForm({ startDate: '', endDate: '', reason: '' })
      setMessage('Leave request submitted for admin approval.')
    } catch (failure) {
      setError(failure.message || 'Your leave request could not be submitted. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async leave => {
    setCancelling(leave._id)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch(`${API_BASE}/api/leaves/${leave._id}/cancel`, { method: 'PUT' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'This leave request could not be cancelled.')
      setLeaves(previous => previous.map(item => item._id === leave._id ? data.leave : item))
      setMessage('Leave request cancelled.')
    } catch (failure) {
      setError(failure.message || 'This leave request could not be cancelled. Please try again.')
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 ml-0 lg:ml-64" id="doctor-leave">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-semibold text-navy">My Leave Requests</h1>
          <p className="mt-2 mb-6 text-navy-muted">Request whole days off and follow your admin’s decision.</p>

          {message && <p role="status" className="mb-5 rounded-xl bg-success-bg p-4 text-success">{message}</p>}
          {error && <p role="alert" className="mb-5 rounded-xl bg-error-bg p-4 text-error">{error}</p>}
          {loadError && <div role="alert" className="mb-5 rounded-xl bg-white p-4 text-navy-muted">
            {loadError} <button type="button" onClick={reload} className="ml-2 text-primary underline">Try again</button>
          </div>}

          <section className="mb-8 rounded-xl border border-outline-variant bg-white p-6" aria-labelledby="request-leave-title">
            <h2 id="request-leave-title" className="text-xl font-semibold text-navy">Request leave</h2>
            <p className="mt-2 mb-5 text-sm text-navy-muted">Both dates are included. Approved leave blocks new appointments. Active appointments must be moved or cancelled before an admin can approve your request.</p>
            <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-navy">
                Start date
                <input type="date" required min={today} value={form.startDate} onChange={event => setForm(previous => ({ ...previous, startDate: event.target.value }))} className="w-full rounded-lg border border-slate-300 p-3" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-navy">
                End date
                <input type="date" required min={form.startDate || today} value={form.endDate} onChange={event => setForm(previous => ({ ...previous, endDate: event.target.value }))} className="w-full rounded-lg border border-slate-300 p-3" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-navy sm:col-span-2">
                Reason
                <textarea required maxLength={1000} rows={3} value={form.reason} onChange={event => setForm(previous => ({ ...previous, reason: event.target.value }))} className="w-full rounded-lg border border-slate-300 p-3" placeholder="Briefly explain the dates you need off" />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={saving || loading || Boolean(loadError)} className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit leave request'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-outline-variant bg-white p-6" aria-labelledby="leave-history-title">
            <h2 id="leave-history-title" className="mb-4 text-xl font-semibold text-navy">Request history</h2>
            {loading ? <p role="status" className="text-navy-muted">Loading leave requests…</p> : !loadError && (leaves.length === 0
              ? <p className="text-navy-muted">You haven’t requested leave yet.</p>
              : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-navy-muted"><tr><th className="p-3">Dates</th><th className="p-3">Reason</th><th className="p-3">Status</th><th className="p-3">Admin response</th><th className="p-3">Action</th></tr></thead>
                <tbody>{leaves.map(leave => <tr key={leave._id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="p-3 whitespace-nowrap">{formatAppointmentDate(leave.startDate)} – {formatAppointmentDate(leave.endDate)}</td>
                  <td className="p-3 max-w-72 wrap-break-word whitespace-pre-wrap">{leave.reason}</td>
                  <td className="p-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusClasses[leave.status] || statusClasses.pending}`}>{statusLabels[leave.status] || leave.status}</span></td>
                  <td className="p-3 max-w-72 wrap-break-word whitespace-pre-wrap">{leave.adminNote || '—'}</td>
                  <td className="p-3">{leave.status === 'pending' && <button type="button" disabled={Boolean(cancelling)} onClick={() => cancel(leave)} aria-label={`Cancel leave request from ${leave.startDate} to ${leave.endDate}`} className="font-medium text-error hover:underline disabled:opacity-50">{cancelling === leave._id ? 'Cancelling…' : 'Cancel request'}</button>}</td>
                </tr>)}</tbody>
              </table></div>)}
          </section>
        </div>
        <Footer />
      </main>
    </div>
  )
}
