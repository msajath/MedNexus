import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'

export default function Messages() {
  useAuth()
  const [messages] = useState([
    {
      id: 1,
      sender: 'Dr. John Smith',
      subject: 'Regarding your appointment',
      preview: 'Your appointment is confirmed for...',
      timestamp: '2 hours ago',
      read: false,
    },
    {
      id: 2,
      sender: 'Patient Support',
      subject: 'Appointment reminder',
      preview: 'This is a reminder for your upcoming appointment...',
      timestamp: '5 hours ago',
      read: true,
    },
  ])

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-navy mb-2">Messages</h1>
          <p className="text-sm text-navy-muted">You have {messages.filter(m => !m.read).length} unread messages</p>
        </div>

        <div className="flex flex-col gap-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <div key={message.id} className={`flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white rounded-xl border border-slate-200 transition-all cursor-pointer hover:shadow-md hover:border-primary ${!message.read ? 'bg-blue-50 border-blue-200' : ''}`}>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-navy mb-1">{message.sender}</h3>
                  <p className="text-[0.95rem] font-medium text-navy mb-2">{message.subject}</p>
                  <p className="text-sm text-navy-muted truncate">{message.preview}</p>
                </div>
                <div className="flex items-center gap-4 mt-2 md:mt-0 md:ml-4 whitespace-nowrap">
                  <span className="text-sm text-slate-400">{message.timestamp}</span>
                  {!message.read && <span className="inline-block px-3 py-1 bg-primary text-white text-xs font-semibold rounded">New</span>}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 px-8 text-center text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
              <p className="text-lg">No messages yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
