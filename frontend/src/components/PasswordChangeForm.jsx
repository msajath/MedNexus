import { useState } from 'react'
import { API_BASE, apiFetch } from '../config'

export default function PasswordChangeForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (form.newPassword !== form.confirmPassword) { setMessage('New passwords do not match.'); return }
    setSaving(true)
    try {
      const response = await apiFetch(`${API_BASE}/api/auth/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.errors?.[0]?.msg || 'Unable to change password')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setMessage('Password updated successfully!')
    } catch (error) { setMessage(error.message) } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="flex flex-col gap-4">
    {Object.entries({ currentPassword: 'Current Password', newPassword: 'New Password', confirmPassword: 'Confirm New Password' }).map(([field, label]) => <label key={field} className="flex flex-col gap-2 text-sm font-medium text-navy">
      {label}<input type="password" autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'} required minLength={field === 'currentPassword' ? 1 : 15} maxLength={72} value={form[field]} onChange={event => setForm({ ...form, [field]: event.target.value })} className="p-3 border border-slate-300 rounded-xl" />
    </label>)}
    {message && <p role="status" className="text-sm text-navy">{message}</p>}
    <button type="submit" disabled={saving} className="px-5 py-2.5 bg-primary text-white font-semibold rounded-lg disabled:opacity-50">{saving ? 'Updating...' : 'Update Password'}</button>
  </form>
}
