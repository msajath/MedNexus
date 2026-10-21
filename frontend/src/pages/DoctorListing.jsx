import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import DoctorCard from '../components/DoctorCard'
import useDoctors from '../hooks/useDoctors'

export default function DoctorListing() {
  const locationObj = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(locationObj.search), [locationObj.search])
  
  const { doctors, loading, error, retrying, retry } = useDoctors()
  const [search, setSearch] = useState('')
  const [specialty, setSpecialty] = useState(queryParams.get('specialty') || 'All Specialties')
  const [location, setLocation] = useState('All Locations')

  const filtered = doctors.filter((d) => {
    // Search string matching
    const searchLower = search.toLowerCase()
    const matchesSearch = 
      d.name.toLowerCase().includes(searchLower) || 
      (d.specialty || '').toLowerCase().includes(searchLower) ||
      (typeof d.location === 'string' && d.location.toLowerCase().includes(searchLower))

    // Match both exact specialties and category links such as Cardiology -> Cardiologist.
    const matchesSpec = specialty === 'All Specialties' ? true : (() => {
      const dSpec = (d.specialty || '').toLowerCase();
      const fSpec = specialty.toLowerCase();
      const map = {
        'cardiology': 'cardiolog',
        'neurology': 'neurolog',
        'pediatrics': 'pediatric',
        'dermatology': 'dermatolog',
        'orthopedics': 'orthopedic',
        'general practice': 'general',
        'general physician': 'general'
      };
      const searchKey = map[fSpec] || fSpec;
      return dSpec === fSpec || dSpec.includes(searchKey);
    })()

    // Location matching
    const matchesLoc = location === 'All Locations' || (typeof d.location === 'string' && d.location.toLowerCase().includes(location.toLowerCase()))
    
    return matchesSearch && matchesSpec && matchesLoc
  })

  // Get unique locations from data for the dropdown
  const uniqueLocations = ['All Locations', ...new Set(doctors.map(d => d.location).filter(Boolean))]
  const uniqueSpecialties = ['All Specialties', ...new Set([...doctors.map(d => d.specialty).filter(Boolean), ...(specialty !== 'All Specialties' ? [specialty] : [])])]

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-8 pb-12" id="doctor-listing">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-navy">Find Your Doctor</h1>
            <p className="mt-2 text-base text-navy-muted">Search from our network of verified healthcare professionals.</p>
          </div>

          <div className="flex flex-col gap-4 p-5 px-6 mb-6 bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3 px-4 py-2 border-[1.5px] border-slate-300 rounded-lg bg-white">
              <span className="material-icons-outlined text-outline">search</span>
              <input type="search" className="w-full border-none outline-none text-base text-on-surface bg-transparent" placeholder="Search by name, specialty, or location..." aria-label="Search doctors" value={search} onChange={(e) => setSearch(e.target.value)} id="doctor-search" />
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <select className="flex-1 p-3 px-4 border-[1.5px] border-slate-300 rounded-lg text-base text-on-surface bg-white outline-none focus:border-primary transition-colors" aria-label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} id="specialty-filter">
                {uniqueSpecialties.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              <select className="flex-1 p-3 px-4 border-[1.5px] border-slate-300 rounded-lg text-base text-on-surface bg-white outline-none focus:border-primary transition-colors" aria-label="Location" value={location} onChange={(e) => setLocation(e.target.value)} id="location-filter">
                {uniqueLocations.map((loc) => (<option key={loc} value={loc}>{loc}</option>))}
              </select>
            </div>
          </div>

          {doctors.length > 0 && <p className="mb-5 text-sm font-medium text-on-surface-variant">{filtered.length} doctors found</p>}

          {(loading || retrying) && (
            <div role="status" className="mb-6 rounded-xl bg-white p-6 text-center text-navy-muted">
              <p>{retrying
                ? 'Doctor information is temporarily unavailable. We’re trying to reconnect…'
                : doctors.length > 0 ? 'Updating doctors…' : 'Loading doctors…'}</p>
              {retrying && <button type="button" onClick={retry} className="mt-4 rounded-lg bg-primary px-5 py-2 font-medium text-white hover:opacity-90">Try again</button>}
            </div>
          )}

          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-slate-200 bg-white p-6 text-center text-navy-muted">
              <p>{error}</p>
              {doctors.length > 0 && <p className="mt-2">The list below was loaded earlier. Availability is checked when you book.</p>}
              <button type="button" onClick={retry} className="mt-4 rounded-lg bg-primary px-5 py-2 font-medium text-white hover:opacity-90">
                Try again
              </button>
            </div>
          )}

          {(doctors.length > 0 || (!loading && !retrying && !error)) && (
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.length > 0 ? (
                filtered.map((doc) => (<DoctorCard key={doc._id || doc.id} doctor={doc} />))
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
