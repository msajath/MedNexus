import { useState } from 'react'
import { API_BASE, apiFetch } from '../config'
import { formatMoney } from '../utils/admin'

const paymentMethods = { cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', other: 'Other' }

export default function AdminAppointmentPayment({ appointment, onRefresh }) {
  const [refundConfirmed, setRefundConfirmed] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const payment = appointment.payment
  const status = appointment.paymentStatus || payment?.status || 'unpaid'
  const identity = appointment.patient?.name || appointment._id

  const savePayment = async event => {
    event.preventDefault()
    if (saving || !refundConfirmed || !refundReason.trim()) return
    setSaving(true)
    setError('')
    setNotice('')
    let saved = false
    try {
      const url = `${API_BASE}/api/admin/payments/${payment.id}/refund`
      const payload = { reason: refundReason.trim() }
      const headers = { 'Content-Type': 'application/json' }
      const response = await apiFetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409) {
          await onRefresh()
          throw new Error(data.message || 'This payment record changed. Review the refreshed receipt before continuing.')
        }
        throw new Error(data.message || 'Unable to save the payment record.')
      }
      saved = true
      await onRefresh()
      setRefundConfirmed(false)
      setRefundReason('')
      setNotice(payment.method === 'auto_credit' ? 'Earnings credit reversed.' : 'Already issued refund recorded.')
    } catch (err) {
      setError(saved ? 'The record was saved, but the refreshed receipt could not be loaded. Reload appointments before making another change.' : err.message || 'Unable to save the payment record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-w-64 max-w-sm text-xs" aria-label={`Payment for ${identity}`}>
      <p className="font-semibold text-navy">{status === 'unpaid' ? 'No payment recorded' : status === 'refunded' ? 'Refunded' : payment?.method === 'auto_credit' ? 'Earnings credited' : 'Payment received'}</p>
      {payment && <dl className="mt-2 space-y-1 text-navy-muted">
        <div><dt className="inline font-semibold">Amount: </dt><dd className="inline">{formatMoney(payment.amount)}</dd></div>
        <div><dt className="inline font-semibold">Method: </dt><dd className="inline">{paymentMethods[payment.method] || payment.method}</dd></div>
        <div><dt className="inline font-semibold">Receipt: </dt><dd className="inline break-all">{payment.id}</dd></div>
        {payment.reference && <div><dt className="inline font-semibold">Reference: </dt><dd className="inline break-all">{payment.reference}</dd></div>}
        {payment.receivedAt && <div><dt className="inline font-semibold">Received: </dt><dd className="inline">{new Date(payment.receivedAt).toLocaleString()}</dd></div>}
        {payment.recordedAt && <div><dt className="inline font-semibold">Recorded: </dt><dd className="inline">{new Date(payment.recordedAt).toLocaleString()}</dd></div>}
        {payment.refundedAt && <div><dt className="inline font-semibold">Refund recorded: </dt><dd className="inline">{new Date(payment.refundedAt).toLocaleString()}</dd></div>}
        {payment.refundReason && <div><dt className="inline font-semibold">Refund reason: </dt><dd className="inline break-words">{payment.refundReason}</dd></div>}
      </dl>}
      {status === 'unpaid' && (
        <p className="mt-2 text-xs text-navy-muted italic">
          {appointment.status === 'completed'
            ? 'No credit recorded. Free or missing historical booked fees need no automatic charge.'
            : appointment.status === 'cancelled'
            ? 'Cancelled appointment ($0.00)'
            : 'Fee will auto-credit when marked Completed'}
        </p>
      )}
      {status === 'received' && payment?.id && <details className="mt-3"><summary className="cursor-pointer font-semibold text-red-700">{payment.method === 'auto_credit' ? 'Reverse earnings credit' : 'Record issued refund'}</summary>
        <form aria-label={`Record refund for ${identity}`} onSubmit={event => savePayment(event, true)} className="space-y-3 mt-3">
          <p className="text-navy-muted">{payment.method === 'auto_credit' ? `Reverse the ${formatMoney(payment.amount)} service earnings credit. This does not move money.` : `Only record this after the full ${formatMoney(payment.amount)} has already been refunded. This form does not send money.`}</p>
          <label className="block font-semibold">Refund reason<textarea aria-label={`Refund reason for ${identity}`} required maxLength={1000} rows={2} value={refundReason} onChange={event => setRefundReason(event.target.value)} disabled={saving} className="block w-full mt-1 p-2 border border-slate-300 rounded-lg font-normal" /></label>
          <label className="flex items-start gap-2 text-navy"><input type="checkbox" required checked={refundConfirmed} onChange={event => setRefundConfirmed(event.target.checked)} disabled={saving} /><span>{payment.method === 'auto_credit' ? 'I confirm this earnings credit should be reversed.' : 'I confirm this payment has already been refunded in full.'}</span></label>
          <button disabled={saving || !refundConfirmed || !refundReason.trim()} type="submit" className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold disabled:opacity-50">{saving ? 'Saving refund...' : payment.method === 'auto_credit' ? 'Reverse credit' : 'Save issued refund'}</button>
        </form>
      </details>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-green-700">{notice}</p>}
    </div>
  )
}
