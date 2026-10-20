import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { API_BASE, apiFetch } from '../config'

export default function SetAvailability() {
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchAvailability = async () => {
    setLoading(true)
    setError(null)
    try {
      // First, get the current user's doctor ID
      const userResponse = await apiFetch(`${API_BASE}/api/auth/me`, {
        })
      if (!userResponse.ok) throw new Error('Could not load your doctor account')
      const userData = await userResponse.json()
      const doctorId = userData.user?.doctorProfile?._id
      if (!doctorId) throw new Error('Doctor profile not found')

      // Fetch availability for this doctor
      const response = await apiFetch(`${API_BASE}/api/availability/${doctorId}`, {
        cache: 'no-store',
        })
      if (!response.ok) throw new Error('Could not load your schedule')
      const data = await response.json()
      const loadedSchedule = data.schedule || data.availability
      if (!Array.isArray(loadedSchedule) || loadedSchedule.length !== 7) throw new Error('Schedule data is incomplete')
      setSchedule(loadedSchedule.map(item =>
        ['Saturday', 'Sunday'].includes(item.day) ? { ...item, enabled: false } : item))
    } catch (err) {
      console.error('Error fetching availability:', err)
      setSchedule([])
      setError(err.message || 'Could not load your schedule')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAvailability()
  }, [])

  const toggleDay = (idx) => {
    if (['Saturday', 'Sunday'].includes(schedule[idx].day)) return
    const updated = [...schedule]
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled }
    setSchedule(updated)
  }

  const updateTime = (idx, field, value) => {
    const updated = [...schedule]
    updated[idx] = { ...updated[idx], [field]: value }
    setSchedule(updated)
  }

  const handleSave = async () => {
    if (schedule.length !== 7 || loading || error) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API_BASE}/api/availability`, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: schedule })
      })
      if (!response.ok) throw new Error('Failed to save availability')
      const data = await response.json()
      setSchedule(data.schedule || schedule)
      alert('Availability updated successfully!')
    } catch (err) {
      console.error('Error saving availability:', err)
      alert('Error saving availability: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300" id="set-availability">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy">Set Availability</h1>
          <p className="mt-2 text-base text-navy-muted">Configure your weekly consulting hours. Patients will only be able to book appointments during these designated windows.</p>
        </div>

        {loading && (
          <div className="text-center p-8">
            <p className="text-navy-muted">Loading your schedule...</p>
          </div>
        )}

        {error && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error} <button type="button" className="ml-2 underline" onClick={fetchAvailability}>Try again</button>
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:px-6 border-b border-surface-container-high">
              <h3 className="text-xl font-semibold text-navy">Weekly Schedule</h3>
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm font-semibold text-navy bg-transparent hover:bg-surface-container rounded-lg transition-colors" onClick={fetchAvailability}>Reload Schedule</button>
                <button className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSave} disabled={saving || schedule.length !== 7 || Boolean(error)}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              {schedule.map((item, idx) => (
                <div key={item.day} className={`flex flex-col md:flex-row items-start md:items-center gap-4 p-4 md:px-6 border-b border-surface-container-high transition-colors ${!item.enabled ? 'bg-surface-container-low' : ''} last:border-b-0`}>
                  <div className="flex items-center gap-4 w-35 shrink-0">
                    <label className="relative inline-block w-12 h-6.5 cursor-pointer group">
                      <input type="checkbox" className="sr-only peer" checked={item.enabled} disabled={['Saturday', 'Sunday'].includes(item.day)} onChange={() => toggleDay(idx)} />
                      <div className="absolute inset-0 bg-surface-container-high rounded-full transition-all duration-300 peer-checked:bg-primary"></div>
                      <div className="absolute left-0.75 bottom-0.75 w-5 h-5 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-5.5"></div>
                    </label>
                    <span className={`text-base font-medium ${!item.enabled ? 'text-outline' : 'text-navy'}`}>{item.day}</span>
                  </div>
                  {item.enabled ? (
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-navy-muted">Start</label>
                        <input type="time" step="1800" className="p-2 px-3 w-32.5 font-mono border-[1.5px] border-slate-300 rounded-lg text-sm text-on-surface bg-white focus:border-primary outline-none transition-colors" value={item.start} onChange={(e) => updateTime(idx, 'start', e.target.value)} />
                      </div>
                      <span className="text-sm text-outline mt-4.5">to</span>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-navy-muted">End</label>
                        <input type="time" step="1800" className="p-2 px-3 w-32.5 font-mono border-[1.5px] border-slate-300 rounded-lg text-sm text-on-surface bg-white focus:border-primary outline-none transition-colors" value={item.end} onChange={(e) => updateTime(idx, 'end', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm italic text-outline">{['Saturday', 'Sunday'].includes(item.day) ? 'Closed for weekend bookings' : 'Closed'}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 p-4 px-6 bg-blue-50 text-navy text-sm border-t border-surface-container-high rounded-b-xl">
              <span className="material-icons-outlined text-[18px] text-info">info</span>
              <p>Settings will be applied immediately to the booking engine.</p>
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
