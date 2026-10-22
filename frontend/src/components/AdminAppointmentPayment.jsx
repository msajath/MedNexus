import { useState } from 'react'
import { API_BASE, apiFetch } from '../config'
import { formatMoney } from '../utils/admin'

const paymentMethods = { cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', other: 'Other' }

export default function AdminAppointmentPayment({ appointment, onRefresh }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [receivedConfirmed, setReceivedConfirmed] = useState(false)
  const [refundConfirmed, setRefundConfirmed] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const payment = appointment.payment
  const status = appointment.paymentStatus || payment?.status || 'unpaid'
  const canRecord = appointment.status !== 'cancelled' && !appointment.bookingHold && status !== 'received'
  const amountValid = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount) && Number(amount) > 0 && Number.isFinite(Number(amount))
  const identity = appointment.patient?.name || appointment._id

  const savePayment = async (event, refund = false) => {
    event.preventDefault()
    if (saving || (refund ? !refundConfirmed || !refundReason.trim() : !receivedConfirmed || !amountValid)) return
    setSaving(true)
    setError('')
    setNotice('')
    let saved = false
    try {
      const url = refund ? `${API_BASE}/api/admin/payments/${payment.id}/refund` : `${API_BASE}/api/admin/appointments/${appointment._id}/payment`
      const payload = refund ? { reason: refundReason.trim() } : { amount: Number(amount), currency: 'USD', method, reference: reference.trim() }
      const response = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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
      setAmount('')
      setReference('')
      setReceivedConfirmed(false)
      setRefundConfirmed(false)
      setRefundReason('')
      setNotice(refund ? 'Already issued refund recorded.' : 'Received payment recorded.')
    } catch (err) {
      setError(saved ? 'The record was saved, but the refreshed receipt could not be loaded. Reload appointments before making another change.' : err.message || 'Unable to save the payment record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-w-64 max-w-sm text-xs" aria-label={`Payment for ${identity}`}>
      <p className="font-semibold text-navy">{status === 'unpaid' ? 'No payment recorded' : status === 'refunded' ? 'Refunded' : 'Payment received'}</p>
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
      {canRecord && <details className="mt-3"><summary className="cursor-pointer font-semibold text-primary">Record received payment</summary>
        <form aria-label={`Record payment for ${identity}`} onSubmit={savePayment} className="space-y-3 mt-3">
          <p className="text-navy-muted">Use this only after money has already been received. This form records a receipt and does not charge or transfer money.</p>
          <label className="block font-semibold">Amount received (USD)<input aria-label={`Amount received for ${identity}`} type="text" inputMode="decimal" required pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?" value={amount} onChange={event => setAmount(event.target.value)} disabled={saving} className="block w-full mt-1 p-2 border border-slate-300 rounded-lg font-normal" placeholder="0.00" /></label>
          <label className="block font-semibold">Payment method<select aria-label={`Payment method for ${identity}`} value={method} onChange={event => setMethod(event.target.value)} disabled={saving} className="block w-full mt-1 p-2 border border-slate-300 rounded-lg font-normal">{Object.entries(paymentMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="block font-semibold">Receipt reference (optional)<input aria-label={`Receipt reference for ${identity}`} type="text" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} disabled={saving} className="block w-full mt-1 p-2 border border-slate-300 rounded-lg font-normal" /></label>
          <p className="text-navy-muted">Do not enter card numbers, security codes, or bank account details.</p>
          <label className="flex items-start gap-2 text-navy"><input type="checkbox" required checked={receivedConfirmed} onChange={event => setReceivedConfirmed(event.target.checked)} disabled={saving} /><span>I confirm this payment has already been received.</span></label>
          <button disabled={saving || !receivedConfirmed || !amountValid} type="submit" className="px-3 py-2 bg-primary text-white rounded-lg font-semibold disabled:opacity-50">{saving ? 'Saving receipt...' : 'Save received payment'}</button>
        </form>
      </details>}
      {status === 'received' && payment?.id && <details className="mt-3"><summary className="cursor-pointer font-semibold text-red-700">Record issued refund</summary>
        <form aria-label={`Record refund for ${identity}`} onSubmit={event => savePayment(event, true)} className="space-y-3 mt-3">
          <p className="text-navy-muted">Only record this after the full {formatMoney(payment.amount)} has already been refunded. This form does not send money.</p>
          <label className="block font-semibold">Refund reason<textarea aria-label={`Refund reason for ${identity}`} required maxLength={1000} rows={2} value={refundReason} onChange={event => setRefundReason(event.target.value)} disabled={saving} className="block w-full mt-1 p-2 border border-slate-300 rounded-lg font-normal" /></label>
          <label className="flex items-start gap-2 text-navy"><input type="checkbox" required checked={refundConfirmed} onChange={event => setRefundConfirmed(event.target.checked)} disabled={saving} /><span>I confirm this payment has already been refunded in full.</span></label>
          <button disabled={saving || !refundConfirmed || !refundReason.trim()} type="submit" className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold disabled:opacity-50">{saving ? 'Saving refund...' : 'Save issued refund'}</button>
        </form>
      </details>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-green-700">{notice}</p>}
    </div>
  )
}
