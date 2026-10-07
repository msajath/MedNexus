import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config'

export default function Messages() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const endpoint = user?.role === 'admin' ? `${API_BASE}/api/admin/contact-messages` : `${API_BASE}/api/messages`
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Unable to load messages')
        const normalizedMessages = (data.messages || []).map((message) => user?.role === 'admin' ? {
          ...message,
          senderName: `${message.name} (${message.email})`,
          body: message.message,
          read: message.status !== 'new',
        } : message)
        setMessages(normalizedMessages)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [user?.role])

  const markAsRead = async (message) => {
    if (message.read) return

    try {
      const endpoint = user?.role === 'admin'
        ? `${API_BASE}/api/admin/contact-messages//status`
        : `${API_BASE}/api/messages//read`
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          ...(user?.role === 'admin' && { 'Content-Type': 'application/json' }),
        },
        ...(user?.role === 'admin' && { body: JSON.stringify({ status: 'in-progress' }) }),
      })
      if (!response.ok) throw new Error('Unable to mark message as read')
      setMessages((current) => current.map((item) => item._id === message._id ? { ...item, read: true } : item))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 lg:ml-64 transition-all duration-300">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-navy mb-2">Messages</h1>
          <p className="text-sm text-navy-muted">You have {messages.filter((message) => !message.read).length} unread messages</p>
        </div>

        {loading && <p className="text-navy-muted">Loading messages...</p>}
        {error && <div className="p-4 mb-5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {!loading && !error && (
          <div className="flex flex-col gap-4">
            {messages.length > 0 ? messages.map((message) => (
              <button key={message._id} type="button" onClick={() => markAsRead(message)} className={`w-full text-left flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white rounded-xl border border-slate-200 transition-all hover:shadow-md hover:border-primary ${!message.read ? 'bg-blue-50 border-blue-200' : ''}`}>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-navy mb-1">{message.senderName}</h3>
                  <p className="text-[0.95rem] font-medium text-navy mb-2">{message.subject}</p>
                  <p className="text-sm text-navy-muted">{message.body}</p>
                </div>
                <div className="flex items-center gap-4 mt-2 md:mt-0 md:ml-4 whitespace-nowrap">
                  <span className="text-sm text-slate-400">{new Date(message.createdAt).toLocaleString()}</span>
                  {!message.read && <span className="inline-block px-3 py-1 bg-primary text-white text-xs font-semibold rounded">New</span>}
                </div>
              </button>
            )) : (
              <div className="py-12 px-8 text-center text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-lg">No messages yet</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
