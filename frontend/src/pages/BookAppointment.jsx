import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const emptySlots = { morning: [], afternoon: [], evening: [] }

// Helper to format a Date as YYYY-MM-DD
const formatDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function BookAppointment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [activeTab, setActiveTab] = useState('morning')
  const [booked, setBooked] = useState(false)
  const [availableSlots, setAvailableSlots] = useState(emptySlots)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookedSlots, setBookedSlots] = useState([])
  const [unavailableSlots, setUnavailableSlots] = useState(emptySlots)

  const fetchDoctor = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/doctors/${id}`)
      if (!response.ok) throw new Error('Doctor not found')
      const data = await response.json()
      setDoctor(data.doctor || data)
      setError(null)
    } catch (err) {
      console.error('Error fetching doctor:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const today = new Date()
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return d
  })

  // Fetch available slots when a date is selected
  const fetchAvailableSlots = async (dateIndex) => {
    setSlotsLoading(true)
    setSelectedSlot(null) // Reset selected slot when date changes
    try {
      const dateStr = formatDate(days[dateIndex])
      const response = await fetch(`http://localhost:5000/api/availability/slots/${id}/${dateStr}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.slots) {
          setAvailableSlots(data.slots)
          setUnavailableSlots(data.unavailableSlots || emptySlots)
          setBookedSlots(data.bookedSlots || [])
        } else {
          setAvailableSlots(emptySlots)
          setUnavailableSlots(emptySlots)
          setBookedSlots([])
        }
      } else {
        setAvailableSlots(emptySlots)
        setUnavailableSlots(emptySlots)
        setBookedSlots([])
      }
    } catch (err) {
      console.error('Error fetching available slots:', err)
      setAvailableSlots(emptySlots)
      setUnavailableSlots(emptySlots)
      setBookedSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  const handleDateSelect = (index) => {
    setSelectedDate(index)
    fetchAvailableSlots(index)
  }

  const handleBook = async () => {
    if (doctor && doctor.available === false) {
      alert('This doctor is currently not available. You cannot book an appointment.')
      return
    }
    if (selectedDate === null || !selectedSlot) {
      alert('Please select both date and time')
      return
    }

    try {
      const dateStr = formatDate(days[selectedDate])
      const response = await fetch('http://localhost:5000/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          doctorId: doctor._id || doctor.id,
          date: dateStr,
          time: selectedSlot
        })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Failed to book appointment')
      
      setBooked(true)
      setTimeout(() => navigate('/patient/appointments'), 2000)
    } catch (err) {
      console.error('Error booking appointment:', err)
      alert('Failed to book appointment: ' + err.message)
    }
  }

  const tabIcons = { morning: 'light_mode', afternoon: 'wb_sunny', evening: 'dark_mode' }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-8 md:py-12">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p>Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-8 md:py-12">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-red-500">Error: {error || 'Doctor not found'}</p>
            <button onClick={() => navigate('/doctors')} className="mt-4 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-full hover:bg-primary-dark transition-colors">
              Back to Doctors
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8 md:py-12" id="book-appointment">
        <div className="max-w-7xl mx-auto px-6">
          {booked ? (
            <div className="text-center py-16 px-8 bg-white rounded-xl shadow-sm border border-slate-200 mt-12 animate-fade-in-up">
              <span className="material-icons-outlined text-[64px] text-success mb-4">check_circle</span>
              <h2 className="text-3xl font-semibold text-navy mb-2">Appointment Booked!</h2>
              <p className="text-base text-navy-muted">Redirecting to your appointments...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-5 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="w-20 h-20 rounded-full bg-linear-to-br from-primary-light to-primary text-white flex items-center justify-center font-bold text-2xl shrink-0">
                    {doctor.name.split(' ').slice(1).map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-3xl font-semibold text-navy">{doctor.name}</h1>
                    <p className="text-base text-primary font-medium">{doctor.specialty}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-navy-muted">
                      <span className="flex items-center gap-1"><span className="material-icons-outlined text-[16px]">star</span> {doctor.rating}</span>
                      <span className="flex items-center gap-1"><span className="material-icons-outlined text-[16px]">work</span> {doctor.experience}</span>
                      <span className="flex items-center gap-1"><span className="material-icons-outlined text-[16px]">location_on</span> {doctor.location}</span>
                    </div>
                  </div>
                  <div className="mt-4 lg:mt-0 text-left lg:text-right">
                    <span className="block text-sm text-navy-muted">Consultation Fee</span>
                    <span className="block text-2xl font-bold text-navy">${doctor.fee}</span>
                  </div>
                </div>

                {!doctor?.available && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    This doctor is currently not available for booking. You cannot book an appointment at this time.
                  </div>
                )}

                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-xl font-semibold text-navy mb-4">Select Date</h2>
                  <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 md:mx-0 md:px-0">
                    {days.map((d, i) => (
                      <button 
                        key={i} 
                        className={`flex flex-col items-center gap-1 p-3 px-4 rounded-xl border-[1.5px] min-w-18 transition-all cursor-pointer ${selectedDate === i ? 'bg-primary border-primary text-white' : 'bg-white border-outline-variant text-navy hover:border-primary hover:text-primary'}`}
                        onClick={() => handleDateSelect(i)}
                      >
                        <span className={`text-xs font-medium ${selectedDate === i ? 'text-white' : 'text-navy-muted'}`}>{d.toLocaleDateString('en', { weekday: 'short' })}</span>
                        <span className="text-xl font-bold">{d.getDate()}</span>
                        <span className={`text-xs ${selectedDate === i ? 'text-white' : 'text-navy-muted'}`}>{d.toLocaleDateString('en', { month: 'short' })}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-xl font-semibold text-navy mb-4">Select Time Slot</h2>
                  <div className="flex flex-wrap gap-3 mb-4">
                    {Object.keys(availableSlots).map((tab) => (
                      <button 
                        key={tab} 
                        className={`flex items-center gap-2 p-2 px-4 rounded-xl border-[1.5px] text-sm font-medium transition-all cursor-pointer ${activeTab === tab ? 'bg-primary border-primary text-white' : 'bg-white border-outline-variant text-navy-muted hover:border-primary hover:text-primary'}`} 
                        onClick={() => setActiveTab(tab)}
                      >
                        <span className="material-icons-outlined text-[18px]">{tabIcons[tab]}</span>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {slotsLoading ? (
                    <div className="text-center py-6 text-navy-muted text-sm">Loading available slots...</div>
                  ) : selectedDate === null ? (
                    <div className="text-center py-6 text-navy-muted text-sm">Please select a date first to see available slots</div>
                  ) : (availableSlots[activeTab] || []).length === 0 && (unavailableSlots[activeTab] || []).length === 0 ? (
                    <div className="text-center py-6 text-navy-muted text-sm">No slots available for this time period</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[...(availableSlots[activeTab] || []), ...(unavailableSlots[activeTab] || [])].map((slot) => {
                        const isBooked = bookedSlots.includes(slot)
                        const isUnavailable = unavailableSlots[activeTab]?.includes(slot)
                        return (
                          <button 
                            key={slot} 
                            disabled={isBooked || isUnavailable}
                            className={`p-3 rounded-xl border-[1.5px] text-sm font-medium transition-all ${
                              isBooked || isUnavailable
                                ? 'bg-red-50 border-dashed border-red-300 text-red-500 cursor-not-allowed line-through'
                                : selectedSlot === slot
                                  ? 'bg-primary border-primary text-white cursor-pointer'
                                  : 'bg-white border-outline-variant text-navy hover:border-primary hover:text-primary cursor-pointer'
                            }`} 
                            onClick={() => !isBooked && !isUnavailable && setSelectedSlot(slot)}
                            title={isBooked ? 'This slot is already booked' : isUnavailable ? 'Doctor unavailable at this time' : `Select ${slot}`}
                          >
                            {slot}
                            {(isBooked || isUnavailable) && <span className="block text-[10px] mt-0.5 no-underline" style={{textDecoration: 'none'}}>{isBooked ? 'Booked' : 'Unavailable'}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 sticky top-25">
                  <h3 className="text-xl font-semibold text-navy mb-5">Booking Summary</h3>
                  <div className="flex justify-between py-3 border-b border-surface-container-high text-sm">
                    <span className="text-outline">Doctor</span>
                    <span className="font-semibold text-navy">{doctor.name}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-surface-container-high text-sm">
                    <span className="text-outline">Date</span>
                    <span className="font-semibold text-navy">{selectedDate !== null ? days[selectedDate].toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-surface-container-high text-sm">
                    <span className="text-outline">Time</span>
                    <span className="font-semibold text-navy">{selectedSlot || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 text-lg font-semibold mt-2">
                    <span className="text-outline">Fee</span>
                    <span className="text-primary font-bold">${doctor.fee}</span>
                  </div>
                  <button 
                    className="w-full mt-4 py-3.5 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed" 
                    disabled={selectedDate === null || !selectedSlot || !doctor?.available} 
                    onClick={handleBook} 
                    id="confirm-booking"
                  >
                    Confirm Booking
                  </button>
                  <p className="flex items-center justify-center gap-1 text-xs text-outline mt-3">
                    <span className="material-icons-outlined text-[14px]">lock</span> 
                    Your health data is protected with 256-bit encryption.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
