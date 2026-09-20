import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import DoctorCard from '../components/DoctorCard'
import { specialties } from '../data/mockData'

export default function DoctorListing() {
  const locationObj = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(locationObj.search), [locationObj.search])
  
  const [doctors, setDoctors] = useState([])
  const [search, setSearch] = useState('')
  const [specialty, setSpecialty] = useState(queryParams.get('specialty') || 'All Specialties')
  const [location, setLocation] = useState('All Locations')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDoctors = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/doctors')
      if (!response.ok) throw new Error('Failed to fetch doctors')
      const data = await response.json()
      setDoctors(data.doctors || data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching doctors:', err)
      setError(err.message)
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctors()
  }, [])

  const filtered = doctors.filter((d) => {
    // Search string matching
    const searchLower = search.toLowerCase()
    const matchesSearch = 
      d.name.toLowerCase().includes(searchLower) || 
      d.specialty.toLowerCase().includes(searchLower) || 
      (d.location && d.location.toLowerCase().includes(searchLower))

    // Specialty matching with mapping for variations (e.g. Cardiology -> Cardiologist)
    const matchesSpec = specialty === 'All Specialties' ? true : (() => {
      const dSpec = d.specialty.toLowerCase();
      const fSpec = specialty.toLowerCase();
      const map = {
        'cardiology': 'cardiolog',
        'neurology': 'neurolog',
        'pediatrics': 'pediatric',
        'dermatology': 'dermatolog',
        'orthopedics': 'orthopedic',
        'general practice': 'general physician',
        'general physician': 'general physician'
      };
      const searchKey = map[fSpec] || fSpec;
      return dSpec.includes(searchKey);
    })()

    // Location matching
    const matchesLoc = location === 'All Locations' || (d.location && d.location.toLowerCase().includes(location.toLowerCase()))
    
    return matchesSearch && matchesSpec && matchesLoc
  })

  // Get unique locations from data for the dropdown
  const uniqueLocations = ['All Locations', ...new Set(doctors.map(d => d.location).filter(Boolean))]

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8 pb-12" id="doctor-listing">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-navy">Find Your Doctor</h1>
            <p className="mt-2 text-base text-navy-muted">Search from our network of verified healthcare professionals.</p>
          </div>

          <div className="flex flex-col gap-4 p-5 px-6 mb-6 bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3 px-4 py-2 border-[1.5px] border-slate-300 rounded-lg bg-white">
              <span className="material-icons-outlined text-outline">search</span>
              <input type="text" className="w-full border-none outline-none text-base text-on-surface bg-transparent" placeholder="Search by name, specialty, or location..." value={search} onChange={(e) => setSearch(e.target.value)} id="doctor-search" />
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <select className="flex-1 p-3 px-4 border-[1.5px] border-slate-300 rounded-lg text-base text-on-surface bg-white outline-none focus:border-primary transition-colors" value={specialty} onChange={(e) => setSpecialty(e.target.value)} id="specialty-filter">
                {specialties.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              <select className="flex-1 p-3 px-4 border-[1.5px] border-slate-300 rounded-lg text-base text-on-surface bg-white outline-none focus:border-primary transition-colors" value={location} onChange={(e) => setLocation(e.target.value)} id="location-filter">
                {uniqueLocations.map((loc) => (<option key={loc} value={loc}>{loc}</option>))}
              </select>
            </div>
          </div>

          <p className="mb-5 text-sm font-medium text-on-surface-variant">{loading ? 'Loading doctors...' : error ? `Error: ${error}` : `${filtered.length} doctors found`}</p>

          {loading && (
            <div className="text-center p-8">
              <p>Loading doctors...</p>
            </div>
          )}

          {error && (
            <div className="text-center p-8 text-red-500">
              <p>Error loading doctors: {error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.length > 0 ? (
                filtered.map((doc) => (<DoctorCard key={doc.id} doctor={doc} />))
              ) : (
                <p>No doctors found matching your criteria.</p>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
