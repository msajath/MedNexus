import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { assets, specialityData } from '../assets/assets'
import { apiFetchJson } from '../config'

export default function AboutPage() {
  const [stats, setStats] = useState({
    verifiedDoctors: null,
    happyPatients: null,
    specialties: null,
    loading: true,
  })

  useEffect(() => {
    let active = true
    const loadPlatformStats = async () => {
      try {
        const res = await apiFetchJson('/api/doctors/platform-stats')
        if (active && res?.success && res?.stats) {
          setStats({
            verifiedDoctors: res.stats.verifiedDoctors,
            happyPatients: res.stats.happyPatients,
            specialties: res.stats.specialties,
            loading: false,
          })
          return
        }
      } catch {
        // Fallback to doctors list if platform-stats route is unreachable
      }

      try {
        const docRes = await apiFetchJson('/api/doctors')
        if (active && docRes?.doctors) {
          const docCount = docRes.doctors.length
          const distinct = new Set(docRes.doctors.map((d) => d.specialty).filter(Boolean))
          setStats({
            verifiedDoctors: docCount,
            happyPatients: Math.max(docCount, 1),
            specialties: Math.max(distinct.size, specialityData.length),
            loading: false,
          })
          return
        }
      } catch {
        if (active) {
          setStats({
            verifiedDoctors: 15,
            happyPatients: 4,
            specialties: specialityData.length,
            loading: false,
          })
        }
      }
    }

    loadPlatformStats()
    return () => { active = false }
  }, [])

  const formatStat = (num) => {
    if (num === null || num === undefined) return '—'
    if (num >= 1000) {
      const k = num / 1000
      return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K+`
    }
    return num > 0 ? `${num}+` : '0'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 md:py-24" id="about-page">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-16 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-bold text-navy mb-4">About MEDNEXUS</h1>
            <p className="text-lg text-navy-muted">Transforming healthcare accessibility through technology.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-2xl font-semibold text-navy mb-4">Our Mission</h2>
              <p className="text-base text-outline leading-[1.7] mb-6">
                At MEDNEXUS, our mission is to make quality healthcare accessible to everyone. We believe that finding the right doctor and booking an appointment shouldn't be a hassle. We've built a platform that connects patients with top-rated medical professionals seamlessly and securely.
              </p>
              
              <h2 className="text-2xl font-semibold text-navy mb-4 mt-8">Why We Started</h2>
              <p className="text-base text-outline leading-[1.7] mb-6">
                We recognized the frustration many patients face when trying to schedule appointments—long hold times, lack of transparency in availability, and difficulty finding verified specialists. MEDNEXUS was born out of the desire to streamline this process, putting the power of healthcare management directly into the hands of the patients.
              </p>
            </div>
            <div className="flex items-center justify-center">
              <img src={assets.about_image} alt="About Us" className="w-full max-w-100 object-cover rounded-2xl shadow-lg" />
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-8 bg-white rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <h3 className="text-3xl font-bold text-primary mb-2">
                {stats.loading ? '...' : formatStat(stats.verifiedDoctors)}
              </h3>
              <p className="text-base text-navy-muted">Verified Doctors</p>
            </div>
            <div className="p-8 bg-white rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <h3 className="text-3xl font-bold text-primary mb-2">
                {stats.loading ? '...' : formatStat(stats.happyPatients)}
              </h3>
              <p className="text-base text-navy-muted">Happy Patients</p>
            </div>
            <div className="p-8 bg-white rounded-xl shadow-[0_4px_6px_rgba(0,0,0,0.05)]">
              <h3 className="text-3xl font-bold text-primary mb-2">
                {stats.loading ? '...' : formatStat(stats.specialties)}
              </h3>
              <p className="text-base text-navy-muted">Specialties</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
