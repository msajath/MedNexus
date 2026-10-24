import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { motion } from 'framer-motion'

export default function PrivacyPolicy() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col bg-surface"
    >
      <Navbar />
      <main className="flex-1 py-12 md:py-16 max-w-4xl mx-auto px-4 md:px-6" id="privacy-policy-page">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
          <div className="border-b border-slate-200 pb-6 mb-8">
            <span className="inline-block px-3 py-1 bg-info-bg text-primary rounded-full text-xs font-semibold mb-3">
              Sri Lankan Regulatory Compliance Notice
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-navy">Privacy Notice & Data Protection Policy</h1>
            <p className="mt-2 text-sm text-navy-muted">
              Aligned with the Personal Data Protection Act No. 9 of 2022 (PDPA) & Personal Data Protection (Amendment) Act No. 22 of 2025
            </p>
            <p className="text-xs text-slate-400 mt-1">Effective Date: October 2026 | Democratic Socialist Republic of Sri Lanka</p>
          </div>

          <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">1. Introduction & Regulatory Scope</h2>
              <p>
                MedNexus (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates an electronic doctor appointment scheduling and health records management platform designed for users in Sri Lanka. We are committed to safeguarding personal data in accordance with the <strong>Personal Data Protection Act No. 9 of 2022 (PDPA)</strong>, the <strong>Personal Data Protection (Amendment) Act No. 22 of 2025</strong>, and Gazettes issued by the Data Protection Authority of Sri Lanka (including Gazette No. 2498/16).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">2. Data Controller and Data Processor Status</h2>
              <p>
                Under Section 2 and 3 of the PDPA:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Data Controller:</strong> MedNexus acts as the Data Controller with respect to user account registration, authentication credentials, administrative system logs, and direct inquiries sent to us.
                </li>
                <li>
                  <strong>Data Processor / Intermediary:</strong> When handling confidential clinical consultation records, diagnoses, and medical observations documented by registered healthcare practitioners, MedNexus functions as a digital intermediary/data processor providing technical infrastructure under strict access barriers.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">3. Lawful Bases for Data Processing</h2>
              <p>
                In accordance with Part I (Sections 5 &amp; 6) of the PDPA, we process personal and sensitive healthcare data under identified lawful bases:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong>Contractual Necessity:</strong> Creating user accounts, managing booking schedules, doctor availability, appointment confirmations, and account security.
                </li>
                <li>
                  <strong>Special Category / Health Data (Section 6 PDPA):</strong> Medical history, consultation notes, diagnoses, and laboratory reports are processed solely for the provision of healthcare services under the professional oversight of registered medical practitioners subject to professional secrecy under the Medical Ordinance, or with the patient&rsquo;s explicit consent.
                </li>
                <li>
                  <strong>Statutory and Clinical Integrity Obligations:</strong> Preserving consultation records and immutable audit histories as required by clinical governance and professional healthcare standards.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">4. Categories of Data Collected</h2>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Identity &amp; Contact:</strong> Full name, email address, telephone number (Sri Lankan domestic 07X or +94 international format), optional National Identity Card (NIC) / passport details where operational verification is justified, and residential address.</li>
                <li><strong>Doctor Professional Information:</strong> Full professional name, Sri Lanka Medical Council (SLMC) registration number, category of registration, qualifications, specialty, and consultation fees.</li>
                <li><strong>Appointment &amp; Financial Information:</strong> Appointment date, time, status, consultation fee snapshot, payment method, reference number, and refund audit history (no payment card or CVV details are stored on platform servers).</li>
                <li><strong>Health &amp; Clinical Data:</strong> Patient-uploaded medical reports, laboratory documents, consultation notes, allergies, and doctor-recorded clinical summaries.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">5. Strict Access Boundaries &amp; Administrative Segregation</h2>
              <p>
                MedNexus applies the <strong>Principle of Minimum Necessary Access</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Administrative Users:</strong> Platform administrators have access only to user accounts, verification statuses, doctor schedules, and payment metadata. Administrators are <em>strictly prohibited</em> by server-side authorization controls from accessing patient medical records or clinical notes.</li>
                <li><strong>Treating Clinicians:</strong> Doctors can only view records of patients with whom they have an active, confirmed, or completed appointment relationship. Patients can mark personal records private to exclude them from clinician view.</li>
                <li><strong>Clinical Record Immutability:</strong> Doctor-authored clinical records cannot be permanently deleted or modified by patients, safeguarding clinical evidence integrity.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">6. Cross-Border Data Hosting &amp; Technical Safeguards</h2>
              <p>
                MedNexus uses reputable cloud hosting services (MongoDB Atlas, Render, Vercel). In compliance with cross-border data transfer safeguards under the PDPA:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>All data in transit is encrypted using mandatory TLS 1.2 / TLS 1.3 encryption; non-TLS connections are rejected.</li>
                <li>All data at rest within MongoDB Atlas is encrypted using AES-256 encryption.</li>
                <li>Passwords are hashed using bcrypt with adaptive salt rounds (cost factor 12) and never stored in plain text.</li>
                <li>Sessions are secured using HttpOnly, SameSite authentication cookies to prevent cross-site scripting (XSS) extraction.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">7. Data Retention &amp; Disposal</h2>
              <p>
                Personal accounts are retained while active. Patient self-uploaded medical attachments can be soft-deleted by the patient. In alignment with Sri Lankan healthcare standards, doctor-authored clinical notes and appointment transaction logs are retained for clinical continuity, audit integrity, and statutory defence periods, and are not automatically expunged upon account deactivation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">8. Data Subject Rights Under PDPA</h2>
              <p>
                Under Part II of the PDPA, Sri Lankan citizens and registered patients have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Request access to their personal data held by MedNexus.</li>
                <li>Request rectification of inaccurate or outdated personal details.</li>
                <li>Withdraw consent where consent is the sole lawful basis of processing (without affecting processing carried out prior to withdrawal).</li>
                <li>Lodge an inquiry or complaint with our Data Protection Officer, or with the <strong>Data Protection Authority of Sri Lanka</strong> (dpa.gov.lk) if a dispute arises.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-navy mb-2">9. Contact &amp; Governance</h2>
              <p>
                For data protection inquiries, access requests, or regulatory clarifications, please contact our privacy compliance team via the platform&rsquo;s Contact page or email us at <code>privacy@mednexus.lk</code>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </motion.div>
  )
}
