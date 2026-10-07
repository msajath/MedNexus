import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import DoctorCard from '../components/DoctorCard'
import { assets, specialityData } from '../assets/assets'
import { motion } from 'framer-motion'
import { API_BASE } from '../config'

export default function HomePage() {
  const [topDoctors, setTopDoctors] = useState([])

  useEffect(() => {
    const fetchTopDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/doctors`)
        if (response.ok) {
          const data = await response.json()
          setTopDoctors((data.doctors || data || []).slice(0, 4))
        }
      } catch (err) {
        console.error('Failed to fetch top doctors:', err)
      }
    }
    fetchTopDoctors()
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      <Navbar />
      {/* Hero Section */}
      <section className="py-16 md:py-24" id="hero">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center gap-12 md:gap-16">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex-1"
          >
            <motion.div variants={itemVariants} className="flex items-center gap-2 mb-4">
              <img src={assets.group_profiles} alt="Profiles" className="h-8" />
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-info-bg text-primary rounded-full text-xs font-semibold">
                <span className="material-icons-outlined text-[14px]">verified</span>
                Trusted by 1,000+ patients
              </span>
            </motion.div>
            <motion.h1 variants={itemVariants} className="text-[28px] md:text-5xl font-bold leading-tight md:leading-[1.2] tracking-tight text-navy mb-6">
              Book Your Doctor<br />Appointment <span className="bg-gradient-to-br from-primary to-primary-light bg-clip-text text-transparent">Instantly</span>
            </motion.h1>
            <motion.p variants={itemVariants} className="text-base md:text-lg text-navy-muted leading-relaxed max-w-[540px] mb-8">
              Connect with over 10,000+ verified specialists across the country. Get expert care from the comfort of your home or find a clinic near you.
            </motion.p>
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link to="/doctors" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white text-base font-semibold rounded-xl hover:bg-primary-dark hover:-translate-y-[1px] hover:shadow-md transition-all">
                <span className="material-icons-outlined">search</span>
                Find a Doctor
              </Link>
              <Link to="/about" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-primary text-primary text-base font-semibold rounded-xl hover:bg-primary hover:text-white transition-all">
                Learn More
              </Link>
            </motion.div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 hidden md:block"
          >
            <div className="relative w-full aspect-square max-w-[500px] mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-[#e0f2fe] to-[#bae6fd] rounded-[2rem] overflow-hidden shadow-3d">
                <motion.img 
                  initial={{ y: 50 }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  src={assets.header_img} 
                  alt="Doctor" 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full object-cover object-bottom" 
                />
              </div>
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="absolute top-[10%] -left-[5%] glass p-4 rounded-2xl shadow-3d-hover flex items-center gap-3 animate-float-1 z-10"
              >
                <span className="material-icons-outlined text-primary text-[32px]">favorite</span>
                <span className="font-semibold text-navy">Health Monitoring</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute top-[45%] -right-[5%] glass p-4 rounded-2xl shadow-3d-hover flex items-center gap-3 animate-float-2 z-10"
              >
                <span className="material-icons-outlined text-success text-[32px]">verified_user</span>
                <span className="font-semibold text-navy">Verified Doctors</span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1 }}
                className="absolute bottom-[15%] left-[10%] glass p-4 rounded-2xl shadow-3d-hover flex items-center gap-3 animate-float-3 z-10"
              >
                <span className="material-icons-outlined text-amber-500 text-[32px]">schedule</span>
                <span className="font-semibold text-navy">24/7 Support</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-surface" id="features">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-navy mb-4">Why Choose MEDNEXUS?</h2>
            <p className="text-base text-navy-muted">Experience healthcare that puts you first.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-3d hover:shadow-3d-hover transition-shadow"
            >
              <div className="w-14 h-14 rounded-xl bg-info-bg flex items-center justify-center mb-6">
                <span className="material-icons-outlined text-primary text-[28px]">calendar_today</span>
              </div>
              <h3 className="text-lg font-semibold text-navy mb-3">Easy Booking</h3>
              <p className="text-base text-navy-muted leading-relaxed">Schedule your appointments in less than 2 minutes with our seamless interface.</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-white p-6 rounded-2xl shadow-3d hover:shadow-3d-hover transition-shadow"
            >
              <div className="w-14 h-14 rounded-xl bg-success-bg flex items-center justify-center mb-6">
                <span className="material-icons-outlined text-success text-[28px]">verified_user</span>
              </div>
              <h3 className="text-lg font-semibold text-navy mb-3">Verified Doctors</h3>
              <p className="text-base text-navy-muted leading-relaxed">Every professional on MEDNEXUS undergoes a rigorous 5-step background verification process.</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-white p-6 rounded-2xl shadow-3d hover:shadow-3d-hover transition-shadow"
            >
              <div className="w-14 h-14 rounded-xl bg-warning-bg flex items-center justify-center mb-6">
                <span className="material-icons-outlined text-warning text-[28px]">bolt</span>
              </div>
              <h3 className="text-lg font-semibold text-navy mb-3">Instant Confirmation</h3>
              <p className="text-base text-navy-muted leading-relaxed">No more waiting. Receive instant SMS and email confirmation for your chosen slot.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Specialties Section */}
      <section className="py-16 md:py-24" id="specialties">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-navy mb-4">Find by Speciality</h2>
            <p className="text-base text-navy-muted">Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.</p>
          </motion.div>
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-6 md:gap-8"
          >
            {specialityData.map((spec, idx) => (
              <motion.div variants={itemVariants} key={idx}>
                <Link to={`/doctors?specialty=${encodeURIComponent(spec.speciality)}`} className="flex flex-col items-center gap-3 group cursor-pointer">
                  <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-full bg-white shadow-3d flex items-center justify-center group-hover:-translate-y-2 group-hover:shadow-3d-hover transition-all duration-300 border border-transparent group-hover:border-primary">
                    <img src={spec.image} alt={spec.speciality} className="w-12 md:w-16 h-12 md:h-16 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <span className="text-sm font-medium text-navy text-center w-full max-w-[100px]">{spec.speciality}</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Top Doctors Section */}
      <section className="py-16 md:py-24 bg-surface" id="top-doctors">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-navy mb-4">Top Doctors to Book</h2>
            <p className="text-base text-navy-muted">Simply browse through our extensive list of trusted doctors.</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topDoctors.map((doc, index) => (
              <DoctorCard key={doc.id} doctor={doc} index={index} />
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/doctors" className="inline-flex px-8 py-3 bg-[#f0f4ff] text-primary rounded-full hover:bg-primary hover:text-white transition-colors text-sm font-semibold shadow-sm hover:shadow-md">more</Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24" id="how-it-works">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-navy mb-4">How MEDNEXUS Works</h2>
            <p className="text-base text-navy-muted">Booking a medical consultation has never been this simple. Follow these three easy steps.</p>
          </motion.div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
            {/* Horizontal Line for Desktop */}
            <div className="hidden md:block absolute top-[40px] left-[10%] right-[10%] h-[2px] bg-outline-variant/30 -z-10"></div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center text-center max-w-[300px] relative"
            >
              <div className="w-[80px] h-[80px] rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold mb-6 border-[8px] border-white shadow-3d z-10 hover:shadow-3d-hover transition-shadow">1</div>
              <h3 className="text-xl font-semibold text-navy mb-3">Find Your Specialist</h3>
              <p className="text-base text-navy-muted leading-relaxed">Search by specialty, location, or insurance provider to find the right doctor for your needs.</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="md:hidden text-primary my-4"
            >
              <span className="material-icons-outlined text-[32px] rotate-90">arrow_forward</span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center text-center max-w-[300px] relative"
            >
              <div className="w-[80px] h-[80px] rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold mb-6 border-[8px] border-white shadow-3d z-10 hover:shadow-3d-hover transition-shadow">2</div>
              <h3 className="text-xl font-semibold text-navy mb-3">Pick a Suitable Slot</h3>
              <p className="text-base text-navy-muted leading-relaxed">View real-time availability and select a date and time that fits perfectly into your schedule.</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="md:hidden text-primary my-4"
            >
              <span className="material-icons-outlined text-[32px] rotate-90">arrow_forward</span>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="flex flex-col items-center text-center max-w-[300px] relative"
            >
              <div className="w-[80px] h-[80px] rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold mb-6 border-[8px] border-white shadow-3d z-10 hover:shadow-3d-hover transition-shadow">3</div>
              <h3 className="text-xl font-semibold text-navy mb-3">Get Confirmed</h3>
              <p className="text-base text-navy-muted leading-relaxed">Complete your booking and receive instant confirmation along with a digital appointment pass.</p>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </motion.div>
  )
}

