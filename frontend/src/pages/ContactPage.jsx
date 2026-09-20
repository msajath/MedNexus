import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { assets } from '../assets/assets'

export default function ContactPage() {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Thank you for your message! Our team will get back to you shortly.");
    e.target.reset();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-16 md:py-24" id="contact-page">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6">
          <div className="text-center mb-16 animate-fade-in-up">
            <h1 className="text-4xl md:text-5xl font-bold text-navy mb-4">Contact Us</h1>
            <p className="text-lg text-navy-muted">We're here to help. Get in touch with our support team.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="bg-surface p-8 md:p-12 rounded-2xl animate-fade-in-up">
              <img src={assets.contact_image} alt="Contact Us" className="w-full h-[200px] object-cover rounded-xl mb-8 shadow-sm" />
              <h2 className="text-2xl font-semibold text-navy mb-8">Get in Touch</h2>

              <div className="flex gap-6 mb-8">
                <div className="w-[50px] h-[50px] rounded-full bg-[#eaf0fb] text-primary flex items-center justify-center shrink-0">
                  <span className="material-icons-outlined">location_on</span>
                </div>
                <div>
                  <h3 className="text-[1.1rem] font-semibold text-navy mb-1">Office Location</h3>
                  <p className="text-base text-outline leading-relaxed">123 Health Avenue, Medical District<br />Sri Lanka, SL 10034</p>
                </div>
              </div>

              <div className="flex gap-6 mb-8">
                <div className="w-[50px] h-[50px] rounded-full bg-[#eaf0fb] text-primary flex items-center justify-center shrink-0">
                  <span className="material-icons-outlined">phone</span>
                </div>
                <div>
                  <h3 className="text-[1.1rem] font-semibold text-navy mb-1">Phone Number</h3>
                  <p className="text-base text-outline leading-relaxed">+94 76 600 2013<br />Mon-Fri 9am to 6pm</p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="w-[50px] h-[50px] rounded-full bg-[#eaf0fb] text-primary flex items-center justify-center shrink-0">
                  <span className="material-icons-outlined">email</span>
                </div>
                <div>
                  <h3 className="text-[1.1rem] font-semibold text-navy mb-1">Email Address</h3>
                  <p className="text-base text-outline leading-relaxed">support@mednexus.com<br />info@mednexus.com</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-2xl shadow-[0_4px_6px_rgba(0,0,0,0.05)] border border-outline-variant animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-2xl font-semibold text-navy mb-8">Send a Message</h2>
              <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-sm font-medium text-navy">Full Name</label>
                  <input type="text" id="name" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-surface-container-lowest focus:border-primary focus:shadow-[0_0_0_3px_rgba(8,145,178,0.15)] transition-all outline-none placeholder-outline" placeholder="John Doe" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-sm font-medium text-navy">Email Address</label>
                  <input type="email" id="email" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-surface-container-lowest focus:border-primary focus:shadow-[0_0_0_3px_rgba(8,145,178,0.15)] transition-all outline-none placeholder-outline" placeholder="john@example.com" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="subject" className="text-sm font-medium text-navy">Subject</label>
                  <input type="text" id="subject" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-surface-container-lowest focus:border-primary focus:shadow-[0_0_0_3px_rgba(8,145,178,0.15)] transition-all outline-none placeholder-outline" placeholder="How can we help?" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="message" className="text-sm font-medium text-navy">Message</label>
                  <textarea id="message" className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-base text-on-surface bg-surface-container-lowest focus:border-primary focus:shadow-[0_0_0_3px_rgba(8,145,178,0.15)] transition-all outline-none placeholder-outline" rows="5" placeholder="Your message here..." required></textarea>
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark hover:-translate-y-[1px] hover:shadow-md transition-all">Send Message</button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
