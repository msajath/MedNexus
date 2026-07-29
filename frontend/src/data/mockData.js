export const doctors = [
  { id: 1, _id: 'doc1', name: 'Dr. Richard James', avatar: '/images/doc1.png', specialty: 'General physician', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'New York, NY', available: false, languages: ['English'] },
  { id: 2, _id: 'doc2', name: 'Dr. Emily Larson', avatar: '/images/doc2.png', specialty: 'Gynecologist', fee: 60, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '3 Years', location: 'Boston, MA', available: true, languages: ['English'] },
  { id: 3, _id: 'doc3', name: 'Dr. Sarah Patel', avatar: '/images/doc3.png', specialty: 'Dermatologist', fee: 30, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '1 Years', location: 'Miami, FL', available: true, languages: ['English'] },
  { id: 4, _id: 'doc4', name: 'Dr. Christopher Lee', avatar: '/images/doc4.png', specialty: 'Pediatricians', fee: 40, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '2 Years', location: 'San Francisco, CA', available: true, languages: ['English'] },
  { id: 5, _id: 'doc5', name: 'Dr. Jennifer Garcia', avatar: '/images/doc5.png', specialty: 'Neurologist', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'Chicago, IL', available: false, languages: ['English'] },
  { id: 6, _id: 'doc6', name: 'Dr. Andrew Williams', avatar: '/images/doc6.png', specialty: 'Neurologist', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'Houston, TX', available: true, languages: ['English'] },
  { id: 7, _id: 'doc7', name: 'Dr. Christopher Davis', avatar: '/images/doc7.png', specialty: 'General physician', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'London, UK', available: true, languages: ['English'] },
  { id: 8, _id: 'doc8', name: 'Dr. Timothy White', avatar: '/images/doc8.png', specialty: 'Gynecologist', fee: 60, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '3 Years', location: 'New York, NY', available: true, languages: ['English'] },
  { id: 9, _id: 'doc9', name: 'Dr. Ava Mitchell', avatar: '/images/doc9.png', specialty: 'Dermatologist', fee: 30, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '1 Years', location: 'Boston, MA', available: false, languages: ['English'] },
  { id: 10, _id: 'doc10', name: 'Dr. Jeffrey King', avatar: '/images/doc10.png', specialty: 'Pediatricians', fee: 40, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '2 Years', location: 'Miami, FL', available: true, languages: ['English'] },
  { id: 11, _id: 'doc11', name: 'Dr. Zoe Kelly', avatar: '/images/doc11.png', specialty: 'Neurologist', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'San Francisco, CA', available: true, languages: ['English'] },
  { id: 12, _id: 'doc12', name: 'Dr. Patrick Harris', avatar: '/images/doc12.png', specialty: 'Neurologist', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'Chicago, IL', available: true, languages: ['English'] },
  { id: 13, _id: 'doc13', name: 'Dr. Chloe Evans', avatar: '/images/doc13.png', specialty: 'General physician', fee: 50, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '4 Years', location: 'Houston, TX', available: false, languages: ['English'] },
  { id: 14, _id: 'doc14', name: 'Dr. Ryan Martinez', avatar: '/images/doc14.png', specialty: 'Gynecologist', fee: 60, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '3 Years', location: 'London, UK', available: true, languages: ['English'] },
  { id: 15, _id: 'doc15', name: 'Dr. Amelia Hill', avatar: '/images/doc15.png', specialty: 'Dermatologist', fee: 30, rating: 4.8, reviews: Math.floor(Math.random() * 200) + 50, experience: '1 Years', location: 'New York, NY', available: true, languages: ['English'] },
]
// Helper to generate dates relative to today
const getRelativeDate = (daysOffset) => {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString().split('T')[0]
}

export const appointments = [
  { id: 1, doctor: 'Dr. Sarah Chen', specialty: 'Cardiology', date: getRelativeDate(0), time: '10:00 AM', status: 'confirmed', type: 'Follow-up', notes: 'Regular check-up for heart condition monitoring.' },
  { id: 2, doctor: 'Dr. James Wilson', specialty: 'General Practice', date: getRelativeDate(-2), time: '2:30 PM', status: 'confirmed', type: 'Consultation', notes: 'Annual physical examination.' },
  { id: 3, doctor: 'Dr. Emily Blunt', specialty: 'Pediatrics', date: getRelativeDate(-5), time: '11:00 AM', status: 'cancelled', type: 'Check-up', notes: 'Cancelled due to personal emergency.' },
  { id: 4, doctor: 'Dr. Robert Chen', specialty: 'Cardiology', date: getRelativeDate(2), time: '9:00 AM', status: 'pending', type: 'New Consultation', notes: 'First appointment for chest pain evaluation.' },
  { id: 5, doctor: 'Dr. Sarah Mitchell', specialty: 'Cardiology', date: getRelativeDate(5), time: '3:00 PM', status: 'confirmed', type: 'Follow-up', notes: 'Post-surgery follow-up visit.' },
]

export const doctorAppointments = [
  { id: 1, patient: 'Marcus Webb', age: 34, date: getRelativeDate(0), time: '09:00 AM', status: 'confirmed', type: 'General Check-up', notes: 'Patient reports dull aching in the lumbar region for 3 weeks. No history of injury. Pain radiates slightly to the left hip. Aggravated by prolonged sitting. Patient requests ergonomic assessment and physical therapy referral.' },
  { id: 2, patient: 'Linda Hartley', age: 58, date: getRelativeDate(0), time: '10:30 AM', status: 'confirmed', type: 'Cardiology Follow-up', notes: 'Regular follow-up for hypertensive heart disease. Patient has been monitoring blood pressure at home with average readings of 135/85. No shortness of breath or edema. Current medication: Lisinopril 10mg.' },
  { id: 3, patient: 'Kevin Brooks', age: 27, date: getRelativeDate(0), time: '02:00 PM', status: 'cancelled', type: 'Allergy Consultation', notes: "Appointment cancelled by patient. Noted as 'personal emergency'. Need to reschedule for the following week. Patient mentioned seasonal allergies earlier this month." },
]

export const timeSlots = {
  morning: ['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
  afternoon: ['12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM'],
  evening: ['04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM'],
}

export const specialties = ['All Specialties', 'Cardiology', 'Neurology', 'Pediatrics', 'Dermatology', 'Orthopedics', 'General Practice']

export const adminStats = {
  totalUsers: '12,482',
  totalDoctors: '842',
  totalAppointments: '3,912',
  pendingApprovals: '28',
}

export const recentActivity = [
  { id: 1, title: 'New Appointment Booked', desc: 'Patient Sarah Miller with Dr. House', time: '2 mins ago', icon: 'calendar_today', color: 'var(--color-primary)' },
  { id: 2, title: 'New Doctor Registration', desc: 'Dr. Alan Grant (Cardiology)', time: '1 hour ago', icon: 'person_add', color: 'var(--color-success)' },
  { id: 3, title: 'System Update Pending', desc: 'Security patches available for node #42', time: '3 hours ago', icon: 'security', color: 'var(--color-warning)' },
  { id: 4, title: 'Profile Verified', desc: 'MediPlus Clinic profile is now live', time: 'Yesterday', icon: 'verified', color: 'var(--color-success)' },
]

export const weeklyAvailability = [
  { day: 'Monday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Tuesday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Wednesday', enabled: true, start: '10:00', end: '16:00' },
  { day: 'Thursday', enabled: true, start: '09:00', end: '17:00' },
  { day: 'Friday', enabled: true, start: '09:00', end: '14:00' },
  { day: 'Saturday', enabled: false, start: '10:00', end: '13:00' },
  { day: 'Sunday', enabled: false, start: '', end: '' },
]
