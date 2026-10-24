import { Link } from 'react-router-dom'
import { assets } from '../assets/assets'

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-outline-variant text-navy-muted pt-12 pb-6" id="main-footer">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start pb-8 border-b border-outline-variant gap-6 md:gap-0">
          <div className="max-w-75">
            <Link to="/" className="flex items-center mb-3">
              <img src={assets.logo} alt="MEDNEXUS Logo" className="w-36" />
            </Link>
            <p className="text-sm leading-relaxed">Your trusted healthcare companion for seamless medical consultations.</p>
          </div>
          <div className="flex flex-wrap gap-4 md:gap-8">
            <Link to="/privacy" className="text-sm text-navy-muted hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-sm text-navy-muted hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/contact" className="text-sm text-navy-muted hover:text-primary transition-colors">Contact Us</Link>
            <Link to="/about" className="text-sm text-navy-muted hover:text-primary transition-colors">About Us</Link>
          </div>
        </div>
        <div className="pt-6 pb-2 text-xs text-slate-500 text-center space-y-1">
          <p><strong>Medical Emergency:</strong> MedNexus is not an emergency service. In a life-threatening situation, call <strong>1990 (Suwa Seriya Ambulance)</strong> or visit the nearest hospital emergency unit immediately.</p>
          <p>© {new Date().getFullYear()} MEDNEXUS Healthcare Platform. Democratic Socialist Republic of Sri Lanka. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
