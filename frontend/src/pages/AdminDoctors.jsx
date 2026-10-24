import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { API_BASE, apiFetch } from '../config'
import { formatMoney } from '../utils/admin'

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [doctorEarnings, setDoctorEarnings] = useState([])
  const [earnings, setEarnings] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [totalDoctorPayouts, setTotalDoctorPayouts] = useState(0)
  const [hospitalRetained, setHospitalRetained] = useState(0)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(null)

  // Fee editing state
  const [editingFee, setEditingFee] = useState(false)
  const [feeInput, setFeeInput] = useState('')
  const [savingFee, setSavingFee] = useState(false)
  const [feeNotice, setFeeNotice] = useState('')

  // Payout Portal Modal state
  const [payoutModalDoctor, setPayoutModalDoctor] = useState(null)
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    routingNumber: '',
    notes: '',
  })
  const [payoutSubmitting, setPayoutSubmitting] = useState(false)
  const [payoutMessage, setPayoutMessage] = useState({ type: '', text: '' })

  const fetchDoctorsAndEarnings = () => {
    return Promise.all([
        apiFetch(`${API_BASE}/api/admin/doctors-detail`),
        apiFetch(`${API_BASE}/api/admin/earnings`),
        apiFetch(`${API_BASE}/api/admin/payouts`),
      ]).then(async ([res, earningsRes, payoutsRes]) => {
      const [data, earningsData, payoutsData] = await Promise.all([
        res.json(),
        earningsRes.json(),
        payoutsRes.json(),
      ])

      if (!res.ok || !earningsRes.ok || !payoutsRes.ok) throw new Error(data.message || earningsData.message || 'Unable to load doctors and earnings.')
      setDoctors(data.doctors || [])
      setDoctorEarnings(earningsData.doctors || [])
      setEarnings(earningsData.earnings || null)
      setTotalDoctorPayouts(earningsData.totalDoctorPayouts || 0)
      setHospitalRetained(earningsData.hospitalRetained || 0)
      setPayouts(payoutsData.payouts || [])
      setError('')
    }).catch(err => {
      setError(err.message || 'Unable to load doctors and earnings.')
    }).finally(() => {
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchDoctorsAndEarnings()
  }, [])

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Deactivate ${name}'s account?`)) return
    setUpdating(userId)
    setError('')
    try {
      const res = await apiFetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setDoctors(prev => prev.filter(d => d.userId !== userId))
        setDoctorEarnings(prev => prev.map(doctor => doctor.userId === userId ? { ...doctor, isActive: false } : doctor))
        if (selected?.userId === userId) setSelected(null)
      } else {
        const data = await res.json()
        throw new Error(data.message || 'Unable to deactivate doctor.')
      }
    } catch (err) {
      setError(err.message || 'Unable to deactivate doctor.')
    } finally {
      setUpdating(null)
    }
  }

  const handleVerify = async (userId) => {
    setUpdating(userId)
    setError('')
    try {
      const res = await apiFetch(`${API_BASE}/api/admin/verify-doctor/${userId}`, { method: 'PUT' })
      if (res.ok) {
        setDoctors(prev => prev.map(d => d.userId === userId ? { ...d, isVerified: true } : d))
        if (selected?.userId === userId) setSelected(prev => ({ ...prev, isVerified: true }))
      } else {
        const data = await res.json()
        throw new Error(data.message || 'Unable to verify doctor.')
      }
    } catch (err) {
      setError(err.message || 'Unable to verify doctor.')
    } finally {
      setUpdating(null)
    }
  }

  // Admin fixes/updates the consultation charge for a doctor
  const handleSaveFee = async (e) => {
    e.preventDefault()
    if (!selected) return
    const feeNum = Number(feeInput)
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      setFeeNotice('Please enter a valid consultation fee.')
      return
    }
    setSavingFee(true)
    setFeeNotice('')
    try {
      const doctorId = selected._id || selected.id
      const res = await apiFetch(`${API_BASE}/api/admin/doctors/${doctorId}/fee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee: feeNum }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDoctors(prev => prev.map(d => (d._id === doctorId || d.id === doctorId) ? { ...d, fee: feeNum } : d))
        setSelected(prev => ({ ...prev, fee: feeNum }))
        setEditingFee(false)
        setFeeNotice(`Fee successfully updated to $${feeNum}.`)
        setTimeout(() => setFeeNotice(''), 4000)
      } else {
        setFeeNotice(data.message || 'Unable to update consultation fee.')
      }
    } catch (err) {
      setFeeNotice(err.message || 'Error saving fee.')
    } finally {
      setSavingFee(false)
    }
  }

  // Open payout portal modal for a specific doctor
  const openPayoutModal = (doc) => {
    const earningsEntry = doctorEarnings.find(e => e.doctorId === (doc._id || doc.id || doc.doctorId))
    const bank = doc.bankDetails || earningsEntry?.bankDetails || {}
    const pendingBalance = earningsEntry?.pendingBalance ?? (earningsEntry?.netReceived || 0)
    setPayoutModalDoctor({ ...doc, pendingBalance })
    setPayoutForm({
      amount: pendingBalance > 0 ? String(pendingBalance) : '',
      bankName: bank.bankName || '',
      accountNumber: bank.accountNumber || '',
      accountHolderName: bank.accountHolderName || doc.name || '',
      routingNumber: bank.routingNumber || '',
      notes: `Consultation earnings payout to ${doc.name || 'doctor'}`,
    })
    setPayoutMessage({ type: '', text: '' })
  }

  // Submit Bank Payout
  const handleProcessPayout = async (e) => {
    e.preventDefault()
    if (!payoutModalDoctor) return
    const amountNum = Number(payoutForm.amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setPayoutMessage({ type: 'error', text: 'Enter a valid positive payout amount.' })
      return
    }
    if (!payoutForm.bankName.trim() || !payoutForm.accountNumber.trim()) {
      setPayoutMessage({ type: 'error', text: 'Doctor bank name and account number are required.' })
      return
    }

    setPayoutSubmitting(true)
    setPayoutMessage({ type: '', text: '' })
    try {
      const doctorId = payoutModalDoctor._id || payoutModalDoctor.id || payoutModalDoctor.doctorId
      const res = await apiFetch(`${API_BASE}/api/admin/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          amount: amountNum,
          bankDetails: {
            bankName: payoutForm.bankName.trim(),
            accountNumber: payoutForm.accountNumber.trim(),
            accountHolderName: payoutForm.accountHolderName.trim(),
            routingNumber: payoutForm.routingNumber.trim(),
          },
          notes: payoutForm.notes.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPayoutMessage({ type: 'success', text: data.message })
        // Refresh doctors & earnings
        await fetchDoctorsAndEarnings()
        setTimeout(() => {
          setPayoutModalDoctor(null)
        }, 1800)
      } else {
        setPayoutMessage({ type: 'error', text: data.message || 'Unable to process bank payout.' })
      }
    } catch (err) {
      setPayoutMessage({ type: 'error', text: err.message || 'Failed to process bank payout.' })
    } finally {
      setPayoutSubmitting(false)
    }
  }

  const copyToClipboard = (text) => navigator.clipboard.writeText(text)

  const cancelPayout = async id => {
    setUpdating(id)
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/payouts/${id}/cancel`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to cancel payout request.')
      await fetchDoctorsAndEarnings()
    } catch (error) { setError(error.message) }
    finally { setUpdating(null) }
  }

  const filtered = doctors.filter(d => {
    const term = search.toLowerCase()
    return !search ||
      d.name?.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.specialty?.toLowerCase().includes(term) ||
      d.location?.toLowerCase().includes(term)
  })

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="admin-doctors">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Doctors, Charges &amp; Earnings</h1>
            <p className="mt-1 text-base text-navy-muted">Set doctor consultation fees, review automated revenue, and prepare doctor salary payouts.</p>
          </div>
          <div className="flex gap-2 text-sm font-semibold">
            <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-xl border border-green-200">
              {doctors.filter(d => d.isVerified).length} Verified Doctors
            </span>
            <span className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-200">
              {doctors.filter(d => !d.isVerified).length} Pending
            </span>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 mb-5 bg-red-50 text-red-700 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchDoctorsAndEarnings} className="underline font-semibold ml-2">Reload data</button>
          </div>
        )}

        {/* Revenue & Salary Payouts Overview */}
        {!loading && (
          <section className="mb-8 bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            <div className="p-6 bg-linear-to-r from-cyan-50/50 via-white to-blue-50/40 border-b border-outline-variant">
              <h2 className="text-xl font-semibold text-navy flex items-center gap-2">
                <span className="material-icons-outlined text-primary text-[24px]">account_balance_wallet</span>
                Revenue, Doctor Income &amp; Bank Salary Management
              </h2>
              <p className="text-sm text-navy-muted mt-1">
                Completed appointments automatically generate hospital revenue and credit doctor earnings. Use the payout portal to prepare salary requests. Real transfers require a connected bank payment provider.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="text-xs uppercase font-semibold text-navy-muted">Total Hospital Revenue</span>
                  <p className="text-2xl font-bold text-navy mt-1">{formatMoney(earnings?.netReceived)}</p>
                  <p className="text-xs text-navy-muted mt-1">From all completed appointments</p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="text-xs uppercase font-semibold text-navy-muted">Total Paid to Doctors (Salary)</span>
                  <p className="text-2xl font-bold text-primary mt-1">{formatMoney(totalDoctorPayouts)}</p>
                  <p className="text-xs text-navy-muted mt-1">{payouts.length} bank transfers completed</p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <span className="text-xs uppercase font-semibold text-navy-muted">Hospital Retained Profit</span>
                  <p className="text-2xl font-bold text-green-700 mt-1">{formatMoney(hospitalRetained)}</p>
                  <p className="text-xs text-navy-muted mt-1">Net after doctor salary disbursements</p>
                </div>
              </div>
            </div>

            {/* Doctor Earnings Breakdown Table */}
            <div className="p-5">
              <h3 className="text-base font-semibold text-navy mb-3">Individual Doctor Earnings &amp; Payout Balances</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-low text-xs uppercase text-navy-muted">
                    <tr>
                      <th className="p-3 text-left font-semibold">Doctor</th>
                      <th className="p-3 text-left font-semibold">Specialty</th>
                      <th className="p-3 text-left font-semibold">Consultation Charge</th>
                      <th className="p-3 text-left font-semibold">Gross Earned</th>
                      <th className="p-3 text-left font-semibold">Paid Out to Bank</th>
                      <th className="p-3 text-left font-semibold">Unpaid Balance</th>
                      <th className="p-3 text-center font-semibold">Bank Payout Portal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorEarnings.map((doc) => {
                      const fullDoc = doctors.find(d => d._id === doc.doctorId || d.id === doc.doctorId)
                      const feeDisplay = fullDoc?.fee ?? doc.fee ?? 100
                      return (
                        <tr key={doc.doctorId} className="border-t border-outline-variant hover:bg-surface/50 transition-colors">
                          <td className="p-3">
                            <span className="font-semibold text-navy block">{doc.name || 'Doctor'}</span>
                            {doc.isActive === false && <span className="text-xs text-red-600 block">Deactivated</span>}
                          </td>
                          <td className="p-3 text-navy-muted">{doc.specialty || '—'}</td>
                          <td className="p-3 font-semibold text-navy">
                            ${feeDisplay}
                            <span className="block text-[11px] text-navy-muted font-normal">Fixed by Admin</span>
                          </td>
                          <td className="p-3 font-semibold text-navy">{formatMoney(doc.netReceived)}</td>
                          <td className="p-3 text-primary font-medium">{formatMoney(doc.totalPaidOut || 0)}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${(doc.pendingBalance || doc.netReceived) > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                              {formatMoney(doc.pendingBalance ?? doc.netReceived ?? 0)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => openPayoutModal(fullDoc || doc)}
                              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors inline-flex items-center gap-1.5 shadow-xs"
                            >
                              <span className="material-icons-outlined text-[14px]">send</span>
                              Prepare Payout
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {doctorEarnings.length === 0 && <p className="p-4 text-center text-navy-muted">No doctors found.</p>}
            </div>
          </section>
        )}

        {/* Doctor Management & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold text-navy">Manage Doctor Accounts &amp; Fix Charges</h2>
          <div className="flex items-center gap-2 px-4 py-2 border-[1.5px] border-slate-300 rounded-xl bg-white w-full sm:w-80">
            <span className="material-icons-outlined text-outline text-[20px]">search</span>
            <input
              aria-label="Search doctor accounts"
              type="text"
              placeholder="Search by name, email, specialty..."
              className="flex-1 border-none outline-none text-sm bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center p-12 text-navy-muted">Loading doctors and earnings...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 flex-1 mb-8">
            {/* Doctor Cards */}
            <div className="flex flex-col gap-3">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
                  <span className="material-icons-outlined text-[48px] mb-2">medical_services</span>
                  <p>No doctors found</p>
                </div>
              ) : filtered.map(doc => (
                <div
                  key={doc._id}
                  onClick={() => {
                    setSelected(selected?._id === doc._id ? null : doc)
                    setEditingFee(false)
                    setFeeInput(String(doc.fee ?? 100))
                    setFeeNotice('')
                  }}
                  className={`cursor-pointer p-5 bg-white rounded-xl border transition-all hover:shadow-md ${selected?._id === doc._id ? 'border-primary shadow-md' : 'border-outline-variant'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-linear-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
                        {doc.avatar ? (
                          <img src={doc.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          doc.name?.split(' ').map(n => n[0]).join('').slice(0, 2)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-navy">{doc.name}</p>
                        <p className="text-sm text-navy-muted">{doc.specialty}</p>
                        <p className="text-xs text-outline mt-0.5">{doc.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        ${doc.fee ?? 100} / visit
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${doc.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {doc.isVerified ? '✓ Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Credentials row */}
                  <div className="mt-3 pt-3 border-t border-surface-container-high grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-outline uppercase tracking-wider font-semibold block text-[10px]">Consultation Charge</span>
                      <span className="text-navy font-semibold">${doc.fee ?? 100} (Set by Admin)</span>
                    </div>
                    <div>
                      <span className="text-outline uppercase tracking-wider font-semibold block text-[10px]">Email</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-navy truncate">{doc.email}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(doc.email) }} className="text-outline hover:text-primary">
                          <span className="material-icons-outlined text-[13px]">content_copy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Doctor Detail Panel */}
            <div>
              {selected ? (
                <div className="sticky top-6 bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="p-5 border-b border-outline-variant bg-linear-to-br from-primary/5 to-primary/10 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-linear-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                      {selected.avatar ? (
                        <img src={selected.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selected.name?.split(' ').map(n => n[0]).join('').slice(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-navy text-lg truncate">{selected.name}</h3>
                      <p className="text-sm text-primary">{selected.specialty}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selected.isVerified ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {selected.isVerified ? '✓ Verified' : '⏳ Pending'}
                        </span>
                        {selected.available && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Available</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-5 text-sm overflow-y-auto max-h-[75vh]">
                    {/* Admin Consultation Fee Fix / Control */}
                    <div className="p-4 bg-cyan-50/60 border border-cyan-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-icons-outlined text-[16px]">price_change</span>
                          Consultation Charge
                        </span>
                        {!editingFee && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFee(true)
                              setFeeInput(String(selected.fee ?? 100))
                              setFeeNotice('')
                            }}
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="material-icons-outlined text-[14px]">edit</span>
                            Fix Charge
                          </button>
                        )}
                      </div>

                      {editingFee ? (
                        <form onSubmit={handleSaveFee} className="space-y-3 mt-2">
                          <div>
                            <label className="text-xs font-medium text-navy block mb-1">Set Doctor Consultation Charge (USD)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-navy font-semibold">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                max="1000000"
                                required
                                value={feeInput}
                                onChange={(e) => setFeeInput(e.target.value)}
                                className="w-full pl-7 pr-3 py-2 border border-cyan-300 rounded-lg text-sm bg-white font-semibold text-navy outline-none focus:border-primary"
                                placeholder="100"
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-navy-muted">This fee is displayed on the home page and profile cards, and auto-credits upon completed visits.</p>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingFee}
                              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
                            >
                              {savingFee ? 'Saving...' : 'Save Charge'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFee(false)}
                              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold text-navy">${selected.fee ?? 100}</p>
                          <p className="text-xs text-navy-muted mt-1">This charge is fixed by administrator only and visible to patients on the home page.</p>
                        </div>
                      )}
                      {feeNotice && <p className="text-xs font-semibold text-primary mt-2">{feeNotice}</p>}
                    </div>

                    {/* Bank Payout / Salary Button */}
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-icons-outlined text-[16px]">account_balance</span>
                          Salary &amp; Bank Transfer
                        </span>
                      </div>
                      <p className="text-xs text-emerald-900 mb-3">
                        Disburse earned revenue or salary to doctor's bank account directly.
                      </p>
                      <button
                        type="button"
                        onClick={() => openPayoutModal(selected)}
                        className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
                      >
                        <span className="material-icons-outlined text-[16px]">payments</span>
                        Open Bank Payout Portal
                      </button>
                    </div>

                    {/* Professional Info */}
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-2">Professional Info</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Specialty', value: selected.specialty },
                          { label: 'Experience', value: selected.experience || '—' },
                          { label: 'Location', value: selected.location || '—' },
                          { label: 'Rating', value: selected.rating ? `${selected.rating} ⭐` : '—' },
                          { label: 'Reviews', value: selected.reviews || '—' },
                        ].map(item => (
                          <div key={item.label} className="p-2.5 bg-surface rounded-lg border border-outline-variant">
                            <p className="text-xs text-outline mb-0.5">{item.label}</p>
                            <p className="font-semibold text-navy text-xs">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selected.bio && (
                      <div>
                        <p className="text-xs font-bold text-outline uppercase tracking-wider mb-1">Bio</p>
                        <p className="text-xs text-navy leading-relaxed">{selected.bio}</p>
                      </div>
                    )}

                    {/* Contact & Account */}
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-wider mb-1">Account &amp; Contact</p>
                      <div className="flex flex-col gap-1 text-xs text-navy">
                        <p>📧 {selected.email}</p>
                        {selected.phone && <p>📞 {selected.phone}</p>}
                        <p>📅 Joined: {selected.joinedDate ? new Date(selected.joinedDate).toLocaleDateString('en-GB') : '—'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
                      {!selected.isVerified && (
                        <button
                          onClick={() => handleVerify(selected.userId)}
                          disabled={updating !== null}
                          className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          ✓ Verify Doctor Account
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(selected.userId, selected.name)}
                        disabled={updating !== null}
                        className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Deactivate Doctor Account
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-dashed border-slate-200 text-navy-muted">
                  <span className="material-icons-outlined text-[36px] mb-2">touch_app</span>
                  <p className="text-sm">Click a doctor to view details and fix charges</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bank Payouts History Section */}
        {!loading && (
          <section className="mb-8 bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            <div className="p-5 border-b border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-navy flex items-center gap-2">
                  <span className="material-icons-outlined text-primary">history</span>
                  Doctor Salary &amp; Bank Transfer History
                </h2>
                <p className="text-sm text-navy-muted mt-1">Payout requests and provider-confirmed transfers. Pending requests have not sent money.</p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-surface-container rounded-full text-navy">
                {payouts.length} Transfers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low text-xs uppercase text-navy-muted">
                  <tr>
                    <th className="p-3 text-left font-semibold">Date &amp; Time</th>
                    <th className="p-3 text-left font-semibold">Doctor</th>
                    <th className="p-3 text-left font-semibold">Bank &amp; Account</th>
                    <th className="p-3 text-left font-semibold">Reference</th>
                    <th className="p-3 text-left font-semibold">Payout Amount</th>
                    <th className="p-3 text-left font-semibold">Processed By</th>
                    <th className="p-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p._id} className="border-t border-outline-variant hover:bg-surface/50">
                      <td className="p-3 text-xs text-navy">
                        {new Date(p.processedAt || p.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-semibold text-navy">
                        {p.doctorUser?.name || 'Doctor'}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-semibold block text-navy">{p.bankDetails?.bankName || 'Direct Bank'}</span>
                        <span className="text-navy-muted font-mono">
                          {p.bankDetails?.accountNumber ? `••••${p.bankDetails.accountNumber.slice(-4)}` : 'Bank Transfer'}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-mono text-navy-muted break-all">
                        {p.reference || '—'}
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        ${p.amount.toFixed(2)}
                      </td>
                      <td className="p-3 text-xs text-navy-muted">
                        {p.processedBy?.name || 'Administrator'}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status}
                        </span>
                        {p.status === 'pending' && <button type="button" disabled={updating !== null} onClick={() => cancelPayout(p._id)} className="block mt-2 text-primary underline">Cancel payout request</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payouts.length === 0 && (
              <div className="p-8 text-center text-navy-muted">
                No bank payouts recorded yet. Use the "Prepare Payout" button above to prepare a salary request for a doctor.
              </div>
            )}
          </section>
        )}

        {/* Payout Portal Modal */}
        {payoutModalDoctor && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-fade-in">
              <div className="p-6 bg-linear-to-r from-primary to-primary-dark text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="material-icons-outlined">payments</span>
                    Doctor Salary &amp; Bank Transfer Portal
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">Prepare an admin-approved salary request. Bank transfers are not connected yet.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayoutModalDoctor(null)}
                  className="text-white/80 hover:text-white p-1 rounded-lg"
                >
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleProcessPayout} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="p-3 bg-surface rounded-xl border border-outline-variant flex items-center justify-between">
                  <div>
                    <span className="text-xs text-outline uppercase font-semibold">Doctor Name</span>
                    <p className="font-bold text-navy">{payoutModalDoctor.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-outline uppercase font-semibold">Available Unpaid Balance</span>
                    <p className="font-bold text-lg text-emerald-700">
                      ${Number(payoutModalDoctor.pendingBalance || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Amount to send */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-navy uppercase">Payout Amount (USD)</label>
                    {payoutModalDoctor.pendingBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayoutForm({ ...payoutForm, amount: String(payoutModalDoctor.pendingBalance) })}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Pay Full Balance (${Number(payoutModalDoctor.pendingBalance).toFixed(2)})
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-navy font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={payoutForm.amount}
                      onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                      className="w-full pl-7 pr-3 py-2.5 border-[1.5px] border-slate-300 rounded-xl text-base font-bold text-navy outline-none focus:border-primary"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Bank Account Fields */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-navy uppercase tracking-wider block flex items-center gap-1.5">
                    <span className="material-icons-outlined text-[16px] text-primary">account_balance</span>
                    Destination Bank Details
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-navy block mb-1">Bank Name *</label>
                      <input
                        type="text"
                        required
                        value={payoutForm.bankName}
                        onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:border-primary"
                        placeholder="e.g. Chase Bank, Citi"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-navy block mb-1">Account Holder Name *</label>
                      <input
                        type="text"
                        required
                        value={payoutForm.accountHolderName}
                        onChange={(e) => setPayoutForm({ ...payoutForm, accountHolderName: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:border-primary"
                        placeholder="Doctor's full name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-navy block mb-1">Account Number *</label>
                      <input
                        type="text"
                        required
                        value={payoutForm.accountNumber}
                        onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white font-mono outline-none focus:border-primary"
                        placeholder="Bank account number"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-navy block mb-1">Routing / IFSC Code</label>
                      <input
                        type="text"
                        value={payoutForm.routingNumber}
                        onChange={(e) => setPayoutForm({ ...payoutForm, routingNumber: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white font-mono outline-none focus:border-primary"
                        placeholder="e.g. 021000021"
                      />
                    </div>
                  </div>
                </div>

                {/* Transfer Notes */}
                <div>
                  <label className="text-xs font-medium text-navy block mb-1">Payment Reference / Salary Note</label>
                  <input
                    type="text"
                    value={payoutForm.notes}
                    onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-primary"
                    placeholder="e.g. October 2026 consultation earnings"
                  />
                </div>

                {payoutMessage.text && (
                  <div className={`p-3 rounded-lg text-xs font-semibold ${payoutMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {payoutMessage.text}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPayoutModalDoctor(null)}
                    disabled={payoutSubmitting}
                    className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-navy hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={payoutSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-icons-outlined text-[18px]">send</span>
                    {payoutSubmitting ? 'Saving...' : 'Save Payout Request'}
                  </button>
                </div>
              </form>
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
