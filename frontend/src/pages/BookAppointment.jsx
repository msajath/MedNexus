import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { API_BASE, apiFetch } from '../config'
import { getBookingDays, bookingDateKey, bookingDateLabel } from '../utils/bookingDates'

const emptySlots = { morning: [], afternoon: [], evening: [] }

export default function BookAppointment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rescheduleId = searchParams.get('reschedule')
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
  const [slotsError, setSlotsError] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const bookingInFlight = useRef(false)
  const slotsRequest = useRef(0)
  const [days] = useState(() => getBookingDays(10))

  const fetchDoctor = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/api/doctors/${id}`)
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
    const requestCounter = slotsRequest
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctor()
    setSelectedDate(null)
    setSelectedSlot(null)
    slotsRequest.current++
    return () => { requestCounter.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fetch available slots when a date is selected
  const fetchAvailableSlots = async (dateIndex) => {
    const requestId = ++slotsRequest.current
    setSlotsLoading(true)
    setSelectedSlot(null) // Reset selected slot when date changes
    setSlotsError('')
    setBookingError('')
    try {
      const dateStr = bookingDateKey(days[dateIndex])
      const response = await apiFetch(`${API_BASE}/api/availability/slots/${id}/${dateStr}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        if (requestId !== slotsRequest.current) return
        if (data.success && data.slots) {
          setAvailableSlots(data.slots)
          setActiveTab(Object.keys(data.slots).find(period => data.slots[period].some(slot => !data.bookedSlots?.includes(slot))) ||
            Object.keys(data.slots).find(period => data.slots[period].length > 0) || 'morning')
          setUnavailableSlots(data.unavailableSlots || emptySlots)
          setBookedSlots(data.bookedSlots || [])
        } else {
          setAvailableSlots(emptySlots)
          setUnavailableSlots(emptySlots)
          setBookedSlots([])
        }
      } else {
        const data = await response.json().catch(() => ({}))
        if (requestId !== slotsRequest.current) return
        setSlotsError(data.message || 'Could not load booking times. Please try again.')
        setAvailableSlots(emptySlots)
        setUnavailableSlots(emptySlots)
        setBookedSlots([])
      }
    } catch (err) {
      if (requestId !== slotsRequest.current) return
      console.error('Error fetching available slots:', err)
      setSlotsError('Could not load booking times. Please try again.')
      setAvailableSlots(emptySlots)
      setUnavailableSlots(emptySlots)
      setBookedSlots([])
    } finally {
      if (requestId === slotsRequest.current) setSlotsLoading(false)
    }
  }

  const handleDateSelect = (index) => {
    setSelectedDate(index)
    fetchAvailableSlots(index)
  }

  const handleBook = async () => {
    if (bookingInFlight.current || booked) return
    if (selectedDate === null || !selectedSlot) {
      setBookingError('Please select both date and time.')
      return
    }

    bookingInFlight.current = true
    setIsBooking(true)
    setBookingError('')
    try {
      const dateStr = bookingDateKey(days[selectedDate])
      const endpoint = rescheduleId ? `/api/appointments/${encodeURIComponent(rescheduleId)}/reschedule` : '/api/appointments'
      const response = await apiFetch(`${API_BASE}${endpoint}`, {
        method: rescheduleId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json' },
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
      if (/already booked/i.test(err.message)) await fetchAvailableSlots(selectedDate)
      setBookingError(err.message)
    } finally {
      bookingInFlight.current = false
      setIsBooking(false)
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
              <h2 className="text-3xl font-semibold text-navy mb-2">{rescheduleId ? 'Appointment Rescheduled!' : 'Appointment Booked!'}</h2>
              <p className="text-base text-navy-muted">Redirecting to your appointments...</p>
            </div>
          ) : (
            <>
              {/* Emergency Alert */}
              <aside aria-label="Emergency Notice" className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-xs md:text-sm text-red-900 flex items-center gap-2">
                <span className="material-icons-outlined text-red-600 text-[18px]">emergency</span>
                <span><strong>Medical Emergency Warning:</strong> MedNexus booking is for scheduled consultations only. In a life-threatening emergency, call <strong>1990 (Suwa Seriya Ambulance)</strong> or go to the nearest hospital emergency unit.</span>
              </aside>
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
                        {doctor.licenseNumber && <span className="flex items-center gap-1 text-primary font-medium">SLMC Reg: {doctor.licenseNumber}</span>}
                      </div>
                    </div>
                    <div className="mt-4 lg:mt-0 text-left lg:text-right">
                      <span className="block text-sm text-navy-muted">Consultation Fee</span>
                      <span className="block text-2xl font-bold text-navy">{doctor.currency === 'LKR' ? `Rs. ${doctor.fee}` : `$${doctor.fee}`}</span>
                    </div>
                  </div>

                <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-xl font-semibold text-navy mb-4">Select Date</h2>
                  {doctor.available === false && <p className="mb-4 rounded-lg bg-amber-50 p-4 text-amber-800">This doctor is currently unavailable for booking.</p>}
                  {doctor.available !== false && <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2 md:mx-0 md:px-0">
                    {days.map((d, i) => (
                      <button 
                        key={i} 
                        className={`flex flex-col items-center gap-1 p-3 px-4 rounded-xl border-[1.5px] min-w-18 transition-all cursor-pointer ${selectedDate === i ? 'bg-primary border-primary text-white' : 'bg-white border-outline-variant text-navy hover:border-primary hover:text-primary'}`}
                        onClick={() => handleDateSelect(i)}
                      >
                        <span className={`text-xs font-medium ${selectedDate === i ? 'text-white' : 'text-navy-muted'}`}>{bookingDateLabel(d, { weekday: 'short' })}</span>
                        <span className="text-xl font-bold">{d.getUTCDate()}</span>
                        <span className={`text-xs ${selectedDate === i ? 'text-white' : 'text-navy-muted'}`}>{bookingDateLabel(d, { month: 'short' })}</span>
                      </button>
                    ))}
                  </div>}
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
                  ) : slotsError ? (
                    <div role="alert" className="text-center py-6 text-red-600 text-sm">{slotsError} {selectedDate !== null && <button type="button" className="underline" onClick={() => fetchAvailableSlots(selectedDate)}>Try again</button>}</div>
                  ) : selectedDate === null ? (
                    <div className="text-center py-6 text-navy-muted text-sm">Please select a date first to see available slots</div>
                  ) : (availableSlots[activeTab] || []).length === 0 ? (
                    <div className="text-center py-6 text-navy-muted text-sm">No booking times for this period. Try another weekday or time period.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(availableSlots[activeTab] || []).map((slot) => {
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
                    <span className="font-semibold text-navy">{selectedDate !== null ? bookingDateLabel(days[selectedDate], { dateStyle: 'medium' }) : '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-surface-container-high text-sm">
                    <span className="text-outline">Time</span>
                    <span className="font-semibold text-navy">{selectedSlot || '—'}</span>
                  </div>
                  <div className="flex justify-between py-3 text-lg font-semibold mt-2">
                    <span className="text-outline">Fee</span>
                    <span className="text-primary font-bold">{doctor.currency === 'LKR' ? `Rs. ${doctor.fee}` : `$${doctor.fee}`}</span>
                  </div>
                  {bookingError && <p role="alert" className="mt-3 text-sm text-red-600">{bookingError}</p>}
                  <button 
                    className="w-full mt-4 py-3.5 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed" 
                    disabled={doctor.available === false || selectedDate === null || !selectedSlot || isBooking || booked}
                    onClick={handleBook} 
                    id="confirm-booking"
                  >
                    {isBooking ? 'Booking...' : rescheduleId ? 'Confirm Reschedule' : 'Confirm Booking'}
                  </button>
                  <p className="flex items-center justify-center gap-1 text-xs text-outline mt-3">
                    <span className="material-icons-outlined text-[14px]">lock</span> 
                    Your appointment is linked to your private account.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
