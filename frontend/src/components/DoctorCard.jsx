import { useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'
import Tilt from 'react-parallax-tilt'
import { motion } from 'framer-motion'

export default function DoctorCard({ doctor, index = 0 }) {
  const navigate = useNavigate();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="h-full"
    >
      <Tilt
        glareEnable={true}
        glareMaxOpacity={0.15}
        scale={1.02}
        transitionSpeed={400}
        tiltMaxAngleX={8}
        tiltMaxAngleY={8}
        className="h-full"
      >
        <div 
          className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-3d hover:shadow-3d-hover transition-shadow duration-300 cursor-pointer border border-slate-100" 
          id={`doctor-card-${doctor.id}`}
          onClick={() => navigate(`/doctors/${doctor._id || doctor.id}`)}
        >
          <div className="bg-[#eaf0fb] w-full aspect-square flex justify-center items-end overflow-hidden">
            <img 
              src={doctor.avatar || assets.profile_pic}
              alt={doctor.name} 
              className="w-full h-full object-cover object-bottom transition-transform duration-500 hover:scale-105" 
            />
          </div>
          <div className="p-5 flex flex-col items-start bg-white flex-1">
            <h3 className="text-[1.1rem] font-semibold text-slate-800 mb-1">{doctor.name}</h3>
            <p className="text-[0.85rem] text-slate-500 font-normal">{doctor.specialty}</p>
          </div>
        </div>
      </Tilt>
    </motion.div>
  )
}

