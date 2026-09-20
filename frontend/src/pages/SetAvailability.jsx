import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'

export default function SetAvailability() {
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchAvailability = async () => {
    try {
      const token = localStorage.getItem('token')
      // First, get the current user's doctor ID
      const userResponse = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const userData = await userResponse.json()
      const doctorId = userData.user?.doctorProfile?._id || userData.user?._id || userData._id

      // Fetch availability for this doctor
      const response = await fetch(`http://localhost:5000/api/availability/${doctorId}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        // If no availability set yet, create default schedule
        const defaultSchedule = [
          { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
          { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
          { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
          { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
          { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
          { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
          { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
        ]
        setSchedule(defaultSchedule)
      } else {
        const data = await response.json()
        setSchedule(data.schedule || data.availability || [])
      }
      setError(null)
    } catch (err) {
      console.error('Error fetching availability:', err)
      // Set default schedule on error
      const defaultSchedule = [
        { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
        { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
        { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
        { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
        { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
        { day: 'Saturday', enabled: false, start: '00:00', end: '00:00' },
        { day: 'Sunday', enabled: false, start: '00:00', end: '00:00' },
      ]
      setSchedule(defaultSchedule)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAvailability()
  }, [])

  const toggleDay = (idx) => {
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
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/availability', {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="set-availability">
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
            Error: {error}
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border border-outline-variant">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:px-6 border-b border-surface-container-high">
              <h3 className="text-xl font-semibold text-navy">Weekly Schedule</h3>
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm font-semibold text-navy bg-transparent hover:bg-surface-container rounded-lg transition-colors" onClick={fetchAvailability}>Reset to Default</button>
                <button className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="flex flex-col">
              {schedule.map((item, idx) => (
                <div key={item.day} className={`flex flex-col md:flex-row items-start md:items-center gap-4 p-4 md:px-6 border-b border-surface-container-high transition-colors ${!item.enabled ? 'bg-surface-container-low' : ''} last:border-b-0`}>
                  <div className="flex items-center gap-4 w-[140px] shrink-0">
                    <label className="relative inline-block w-12 h-[26px] cursor-pointer group">
                      <input type="checkbox" className="sr-only peer" checked={item.enabled} onChange={() => toggleDay(idx)} />
                      <div className="absolute inset-0 bg-surface-container-high rounded-full transition-all duration-300 peer-checked:bg-primary"></div>
                      <div className="absolute left-[3px] bottom-[3px] w-5 h-5 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-[22px]"></div>
                    </label>
                    <span className={`text-base font-medium ${!item.enabled ? 'text-outline' : 'text-navy'}`}>{item.day}</span>
                  </div>
                  {item.enabled ? (
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-navy-muted">Start</label>
                        <input type="time" className="p-2 px-3 w-[130px] font-mono border-[1.5px] border-slate-300 rounded-lg text-sm text-on-surface bg-white focus:border-primary outline-none transition-colors" value={item.start} onChange={(e) => updateTime(idx, 'start', e.target.value)} />
                      </div>
                      <span className="text-sm text-outline mt-[18px]">to</span>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-navy-muted">End</label>
                        <input type="time" className="p-2 px-3 w-[130px] font-mono border-[1.5px] border-slate-300 rounded-lg text-sm text-on-surface bg-white focus:border-primary outline-none transition-colors" value={item.end} onChange={(e) => updateTime(idx, 'end', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm italic text-outline">Closed</span>
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
