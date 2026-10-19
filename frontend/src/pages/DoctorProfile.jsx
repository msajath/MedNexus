import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { assets } from '../assets/assets'
import { API_BASE, apiFetch } from '../config'
import { getBookingDays, bookingDateKey, bookingDateLabel } from '../utils/bookingDates'

export default function DoctorProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedDate, setSelectedDate] = useState(0) // Index of selected day
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [booked, setBooked] = useState(false)
  const [timeSlots, setTimeSlots] = useState([])
  const [bookedSlots, setBookedSlots] = useState([])
  const [unavailableSlots, setUnavailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const bookingInFlight = useRef(false)
  const slotsRequest = useRef(0)
  const [days] = useState(() => getBookingDays(7))

  const fetchDoctor = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/api/doctors/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Doctor not found')
        } else {
          throw new Error('Failed to fetch doctor')
        }
        return
      }
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

  // Fetch available slots when date is selected
  const fetchAvailableSlots = async (dateIndex) => {
    const requestId = ++slotsRequest.current
    setSlotsLoading(true)
    setSelectedSlot(null)
    setTimeSlots([])
    setUnavailableSlots([])
    setBookedSlots([])
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
          // Flatten all slots into a single list for this view
          const allSlots = [
            ...(data.slots.morning || []),
            ...(data.slots.afternoon || []),
            ...(data.slots.evening || []),
          ]
          setTimeSlots(allSlots)
          setUnavailableSlots([
            ...(data.unavailableSlots?.morning || []),
            ...(data.unavailableSlots?.afternoon || []),
            ...(data.unavailableSlots?.evening || []),
          ])
          setBookedSlots(data.bookedSlots || [])
        }
      } else {
        const data = await response.json().catch(() => ({}))
        if (requestId !== slotsRequest.current) return
        setSlotsError(data.message || 'Could not load booking times. Please try again.')
      }
    } catch (err) {
      if (requestId !== slotsRequest.current) return
      console.error('Error fetching available slots:', err)
      setSlotsError('Could not load booking times. Please try again.')
      setTimeSlots([])
      setUnavailableSlots([])
      setBookedSlots([])
    } finally {
      if (requestId === slotsRequest.current) setSlotsLoading(false)
    }
  }

  const handleDateSelect = (index) => {
    setSelectedDate(index)
    fetchAvailableSlots(index)
  }

  useEffect(() => {
    const requestCounter = slotsRequest
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDate(0)
    fetchAvailableSlots(0)
    return () => { requestCounter.current++ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleBook = async () => {
    if (bookingInFlight.current || booked) return
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (selectedDate === null || !selectedSlot) {
      setBookingError('Please select both date and time.')
      return
    }

    bookingInFlight.current = true
    setIsBooking(true)
    setBookingError('')
    try {
      const dateStr = bookingDateKey(days[selectedDate])
      const response = await apiFetch(`${API_BASE}/api/appointments`, {
        method: 'POST',
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-6 py-16 text-center">
            <p>Loading doctor profile...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-6 py-16 text-center">
            <p className="text-red-500">Error: {error || 'Doctor not found'}</p>
            <button onClick={() => navigate('/doctors')} className="mt-4 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-full hover:bg-primary-dark transition-colors">
              Back to Doctors
            </button>
          </div>
        </main>
      </div>
    )
  }

  const docImage = doctor.avatar || assets.profile_pic;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8" id="doctor-profile">
        <div className="max-w-250 mx-auto px-4">
          {booked ? (
            <div className="text-center py-16 px-8 bg-white rounded-xl shadow-sm border border-slate-200 animate-fade-in-up">
              <span className="material-icons-outlined text-[64px] text-success mb-4">check_circle</span>
              <h2 className="text-3xl font-semibold text-navy mb-2">Appointment Booked!</h2>
              <p className="text-base text-navy-muted">Redirecting to your appointments...</p>
            </div>
          ) : (
            <>
              {/* Doctor Header Card */}
              <div className="flex flex-col md:flex-row bg-white rounded-xl overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,0.05)] border border-slate-200 mb-8">
                <div className="w-full md:w-70 h-75 md:h-auto bg-[#5a66ff] flex justify-center items-end shrink-0">
                  <img src={docImage} alt={doctor.name} className="w-full h-full object-cover object-bottom" />
                </div>
                <div className="p-6 md:p-10 flex-1">
                  <h1 className="text-3xl font-semibold text-navy flex items-center gap-2 mb-2">
                    {doctor.name} <span className="material-icons-outlined text-blue-600 text-2xl">verified</span>
                  </h1>
                  <div className="text-base text-slate-500 flex items-center gap-4 mb-8">
                    {doctor.specialty} <span className="bg-white border border-slate-200 rounded-full px-3 py-1 text-sm text-slate-600">{doctor.experience || 'Experience not provided'}</span>
                  </div>
                  
                  <div className="mb-8">
                    <h3 className="text-[1.1rem] font-semibold text-navy flex items-center gap-1.5 mb-2">
                      About <span className="material-icons-outlined text-base text-slate-400">info</span>
                    </h3>
                    <p className="text-[0.95rem] leading-[1.6] text-slate-500">
                      Dr. {doctor.name.split(' ').pop()} has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies. Dr. {doctor.name.split(' ').pop()} has a strong commitment to delivering comprehensive medical care, focusing on preventive medicine, early diagnosis, and effective treatment strategies.
                    </p>
                  </div>

                  <p className="text-[1.1rem] text-slate-600">Appointment fee: <span className="font-bold text-navy">${doctor.fee}</span></p>
                </div>
              </div>

              {/* Booking Section */}
              <div className="py-4">
                <h3 className="text-xl font-semibold text-slate-600 mb-6">Booking slots</h3>
                
                {doctor.available === false && <p className="mb-4 rounded-lg bg-amber-50 p-4 text-amber-800">This doctor is currently unavailable for booking.</p>}
                {doctor.available !== false && <div className="flex gap-4 overflow-x-auto pb-4 mb-4">
                  {days.map((d, i) => (
                    <button 
                      key={i} 
                      className={`flex flex-col items-center justify-center min-w-16 h-20 rounded-full border transition-all ${selectedDate === i ? 'bg-[#5a66ff] border-[#5a66ff] text-white' : 'bg-white border-slate-200 hover:border-[#5a66ff] text-navy'}`}
                      onClick={() => handleDateSelect(i)}
                    >
                      <span className={`text-xs font-semibold mb-1 ${selectedDate === i ? 'text-white' : 'text-slate-500'}`}>{bookingDateLabel(d, { weekday: 'short' }).toUpperCase()}</span>
                      <span className="text-[1.1rem] font-medium">{d.getUTCDate()}</span>
                    </button>
                  ))}
                </div>}

                {doctor.available !== false && <div className="flex flex-wrap gap-4 mb-8">
                  {slotsLoading ? (
                    <p className="text-slate-400 text-sm py-4">Loading available slots...</p>
                  ) : slotsError ? (
                    <p role="alert" className="text-red-600 text-sm py-4">{slotsError} <button type="button" className="underline" onClick={() => fetchAvailableSlots(selectedDate)}>Try again</button></p>
                  ) : timeSlots.length === 0 ? (
                    <p className="text-slate-500 text-sm py-4">No booking times for this day. Please choose another weekday.</p>
                  ) : (
                    timeSlots.map(time => {
                      const isBooked = bookedSlots.includes(time)
                      const isUnavailable = unavailableSlots.includes(time)
                      return (
                        <button 
                          key={time} 
                          disabled={isBooked || isUnavailable}
                          className={`px-6 py-2.5 rounded-full border text-sm transition-all ${
                              isBooked || isUnavailable
                              ? 'bg-red-50 border-dashed border-red-300 text-red-500 cursor-not-allowed line-through'
                              : selectedSlot === time
                                ? 'bg-[#5a66ff] border-[#5a66ff] text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-[#5a66ff] hover:text-[#5a66ff]'
                          }`}
                          onClick={() => !isBooked && !isUnavailable && setSelectedSlot(time)}
                          title={isBooked ? 'Already booked' : isUnavailable ? 'Doctor unavailable at this time' : `Select ${time}`}
                        >
                          {time}
                        </button>
                      )
                    })
                  )}
                </div>}

                {bookingError && <p role="alert" className="mb-3 text-sm text-red-600">{bookingError}</p>}
                <button 
                  className="px-12 py-3.5 bg-[#5a66ff] text-white text-base font-medium rounded-full hover:bg-indigo-600 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed" 
                  onClick={handleBook}
                  disabled={doctor.available === false || !selectedSlot || isBooking}
                >
                  {isBooking ? 'Booking...' : 'Book an appointment'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
