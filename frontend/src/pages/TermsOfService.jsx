import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function TermsOfService() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col bg-surface"
    >
      <Navbar />
      <main className="flex-1 py-12 md:py-16 max-w-4xl mx-auto px-4 md:px-6" id="terms-of-service-page">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold mb-3">
              Platform Terms &amp; Medical Disclaimer
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-navy">Terms of Service</h1>
            <p className="mt-2 text-sm text-navy-muted">
              Governing use of MedNexus healthcare management and doctor appointment scheduling services in Sri Lanka
            </p>
            <p className="text-xs text-slate-400 mt-1">Last Updated: October 2026 | Colombo, Sri Lanka</p>
          </div>

          {/* Emergency Alert Box */}
          <div className="p-4 mb-8 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-800 text-sm">
            <div className="flex items-center gap-2 font-bold mb-1 text-base text-red-900">
              <span className="material-icons-outlined text-red-600">emergency</span>
              MEDICAL EMERGENCY WARNING &amp; DISCLAIMER
            </div>
            <p>
              MedNexus is <strong>NOT</strong> an emergency medical dispatch or emergency triage facility. If you or someone you are assisting is experiencing an acute, life-threatening medical emergency (such as severe chest pain, sudden numbness or speech difficulty, severe breathing distress, uncontrolled bleeding, or acute trauma), <strong>immediately call the National Emergency Ambulance Service at 1990 (Suwa Seriya)</strong> or visit the nearest government or private hospital casualty department immediately.
            </p>
          </div>

          <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">1. The MedNexus Platform Role</h2>
              <p>
                MedNexus is an electronic scheduling, patient health documentation, and healthcare administrative technology platform. MedNexus provides digital infrastructure to connect patients with registered medical practitioners and specialists practicing in Sri Lanka.
              </p>
              <p className="mt-2">
                MedNexus itself is a technology software platform and does not practice medicine. The medical advice, clinical examinations, diagnoses, prescriptions, and treatments are provided solely by independent medical practitioners registered with the <strong>Sri Lanka Medical Council (SLMC)</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">2. Doctor Professional Standing &amp; Qualifications</h2>
              <p>
                All medical practitioners participating on MedNexus must be registered with the Sri Lanka Medical Council under the <strong>Medical Ordinance (Chapter 105)</strong> and relevant amendments. Practitioners represent that their qualifications, specialty, and SLMC registration numbers are accurate and current.
              </p>
              <p className="mt-2">
                In compliance with SLMC ethical conduct and advertising regulations, practitioner profiles display factual qualifications and experience without claims of professional superiority or guaranteed outcomes. Practitioners designated as Specialists or Consultants must be registered on the formal SLMC Specialist Register.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">3. Appointments, Channeling &amp; Schedules</h2>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Appointments are confirmed for scheduled clinic consultation times in Sri Lanka (Asia/Colombo timezone).</li>
                <li>Weekend schedules are subject to practitioner availability and clinic operational hours.</li>
                <li>Patients may reschedule appointments prior to the consultation slot using the platform&rsquo;s reschedule feature, subject to doctor availability and absence of approved doctor leave.</li>
                <li>In the event a doctor must take sudden professional or emergency leave, affected appointments will be notified for rescheduling or full refund.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">4. Consultation Fees &amp; Payments</h2>
              <p>
                Consultation fees are set by the respective practitioner or clinic and clearly presented in Sri Lankan Rupees (LKR) or supported denomination prior to booking.
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Payment records and receipts on MedNexus document authorized clinic receipts or platform administrative receipts.</li>
                <li>MedNexus does not directly store sensitive payment card details or CVVs.</li>
                <li>Refunds for cancelled or unfulfilled consultations are processed by platform administrators and audited through atomic state records.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">5. Clinical Records &amp; NMRA Prescription Notice</h2>
              <p>
                Consultation notes, diagnoses, and medication summaries recorded on MedNexus are intended for clinical history and patient reference.
              </p>
              <p className="mt-2">
                Under the <strong>National Medicines Regulatory Authority (NMRA) Act No. 5 of 2015</strong>, electronic prescriptions intended for retail pharmacy dispensing must be authenticated and issued by authorized registered medical practitioners in compliance with applicable pharmacy guidelines. Digital summaries on MedNexus do not replace an official written or signed prescription unless issued under an authorized e-prescribing integration.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">6. User Conduct &amp; Account Security</h2>
              <p>
                Users agree to provide truthful identity, contact, and medical information. Patients and doctors are responsible for maintaining the confidentiality of their login credentials. Any unauthorized access should be reported immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">7. Governing Law &amp; Jurisdiction</h2>
              <p>
                These Terms of Service are governed by and construed in accordance with the laws of the <strong>Democratic Socialist Republic of Sri Lanka</strong>. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent courts of Sri Lanka.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">8. Contact Information</h2>
              <p>
                For questions regarding these Terms or platform operations, visit our <Link to="/contact" className="text-primary hover:underline font-medium">Contact page</Link> or reach our administrative team at <code>support@mednexus.lk</code>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </motion.div>
  )
}
