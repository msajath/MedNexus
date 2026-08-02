import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'

const typeColors = {
  Prescription: 'bg-blue-50 text-blue-700',
  'Lab Report': 'bg-purple-50 text-purple-700',
  Diagnosis: 'bg-red-50 text-red-700',
  Vaccination: 'bg-green-50 text-green-700',
  Imaging: 'bg-orange-50 text-orange-700',
  'Discharge Summary': 'bg-yellow-50 text-yellow-700',
  Other: 'bg-slate-50 text-slate-600',
}

export default function AdminRecords() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selected, setSelected] = useState(null)

  const TYPES = ['All', 'Prescription', 'Lab Report', 'Diagnosis', 'Vaccination', 'Imaging', 'Discharge Summary', 'Other']

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/admin/records', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setRecords(data.records || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords()
  }, [])

  const filtered = records.filter(r => {
    const matchType = typeFilter === 'All' || r.type === typeFilter
    const term = search.toLowerCase()
    const matchSearch = !search ||
      r.title?.toLowerCase().includes(term) ||
      r.patient?.name?.toLowerCase().includes(term) ||
      r.patient?.email?.toLowerCase().includes(term) ||
      r.type?.toLowerCase().includes(term)
    return matchType && matchSearch
  })

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="admin-records">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-navy">Medical Records</h1>
          <p className="mt-1 text-base text-navy-muted">View all patient medical records across the platform.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Records', value: records.length, icon: 'folder_open', color: 'text-primary' },
            { label: 'Prescriptions', value: records.filter(r => r.type === 'Prescription').length, icon: 'medication', color: 'text-blue-600' },
            { label: 'Lab Reports', value: records.filter(r => r.type === 'Lab Report').length, icon: 'biotech', color: 'text-purple-600' },
            { label: 'Diagnoses', value: records.filter(r => r.type === 'Diagnosis').length, icon: 'medical_information', color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-outline-variant shadow-sm">
              <span className={`material-icons-outlined ${s.color} text-[28px]`}>{s.icon}</span>
              <div>
                <p className="text-2xl font-bold text-navy">{s.value}</p>
                <p className="text-xs text-navy-muted">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-slate-300 rounded-xl bg-white flex-1 max-w-md">
            <span className="material-icons-outlined text-outline text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search by patient, title, type..."
              className="flex-1 border-none outline-none text-sm bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${typeFilter === t ? 'bg-primary text-white border-primary' : 'bg-white text-navy-muted border-slate-200 hover:border-primary hover:text-primary'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 flex-1">
          {/* List */}
          <div>
            {loading ? (
              <div className="text-center p-12 text-navy-muted">Loading records...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-navy-muted bg-white rounded-xl border border-dashed border-slate-300">
                <span className="material-icons-outlined text-[48px] mb-2">folder_open</span>
                <p>No records found</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(record => {
                  const isSelected = selected?._id === record._id
                  return (
                    <div
                      key={record._id}
                      onClick={() => setSelected(isSelected ? null : record)}
                      className={`cursor-pointer p-4 bg-white rounded-xl border transition-all hover:shadow-md ${isSelected ? 'border-primary shadow-md' : 'border-outline-variant'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-light to-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {record.patient?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-navy">{record.title}</p>
                            <p className="text-xs text-navy-muted">Patient: {record.patient?.name} · {record.date}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${typeColors[record.type] || typeColors['Other']}`}>{record.type}</span>
                      </div>
                      {record.description && (
                        <p className="mt-2 ml-12 text-xs text-navy-muted line-clamp-1">{record.description}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <div className="sticky top-6 bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className="p-5 border-b border-outline-variant bg-surface-container-low">
                  <h3 className="font-semibold text-navy">{selected.title}</h3>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${typeColors[selected.type]}`}>{selected.type}</span>
                    <span className="text-xs text-navy-muted">{selected.date}</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">Patient</p>
                    <p className="text-navy">{selected.patient?.name} <span className="text-navy-muted">({selected.patient?.email})</span></p>
                  </div>
                  {selected.doctor && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">Added by Doctor</p>
                      <p className="text-navy">{selected.doctor?.user?.name}</p>
                    </div>
                  )}
                  {selected.diagnosis && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">Diagnosis</p>
                      <p className="text-navy">{selected.diagnosis}</p>
                    </div>
                  )}
                  {selected.description && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">Description</p>
                      <p className="text-navy leading-relaxed">{selected.description}</p>
                    </div>
                  )}
                  {selected.medications?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-2">Medications</p>
                      {selected.medications.map((m, i) => (
                        <div key={i} className="p-2.5 bg-surface rounded-lg mb-1.5 border border-outline-variant">
                          <p className="font-semibold text-navy text-xs">{m.name}</p>
                          <p className="text-xs text-navy-muted">{m.dosage} · {m.frequency} · {m.duration}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center bg-white rounded-xl border border-dashed border-slate-200 text-navy-muted">
                <span className="material-icons-outlined text-[32px] mb-2">touch_app</span>
                <p className="text-sm">Click a record to view details</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
