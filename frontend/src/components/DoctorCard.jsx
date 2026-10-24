import { Link } from 'react-router-dom'
import { assets } from '../assets/assets'
import { motion } from 'framer-motion'

export default function DoctorCard({ doctor, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
        <Link
          className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-3d hover:shadow-3d-hover transition-shadow duration-300 cursor-pointer border border-slate-100" 
          id={`doctor-card-${doctor._id || doctor.id}`}
          to={`/doctors/${doctor._id || doctor.id}`}
        >
          <div className="bg-[#eaf0fb] w-full aspect-square flex justify-center items-end overflow-hidden">
            <img 
              src={doctor.avatar || assets.profile_pic}
              alt={doctor.name} 
              className="w-full h-full object-cover object-bottom transition-transform duration-500 hover:scale-105" 
            />
          </div>
          <div className="p-5 flex flex-col items-start bg-white flex-1 w-full">
            <h3 className="text-[1.1rem] font-semibold text-slate-800 mb-1">{doctor.name}</h3>
            <p className="text-[0.85rem] text-slate-500 font-normal">{doctor.specialty}</p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between w-full">
              <span className="text-xs font-medium text-navy-muted">Consultation Fee</span>
              <span className="text-sm font-bold text-primary">${doctor.fee ?? 100}</span>
            </div>
            {doctor.available === false && <p className="mt-2 text-xs font-medium text-amber-700">Currently unavailable for booking</p>}
          </div>
        </Link>
    </motion.div>
  )
}

