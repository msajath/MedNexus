import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { getLocalDateString } from '../utils/date'

const RECORD_TYPES = ['All', 'Prescription', 'Lab Report', 'Diagnosis', 'Vaccination', 'Imaging', 'Discharge Summary', 'Other']

const typeColors = {
  Prescription: 'bg-blue-50 text-blue-700 border-blue-200',
  'Lab Report': 'bg-purple-50 text-purple-700 border-purple-200',
  Diagnosis: 'bg-red-50 text-red-700 border-red-200',
  Vaccination: 'bg-green-50 text-green-700 border-green-200',
  Imaging: 'bg-orange-50 text-orange-700 border-orange-200',
  'Discharge Summary': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Other: 'bg-slate-50 text-slate-600 border-slate-200',
}

const typeIcons = {
  Prescription: 'medication',
  'Lab Report': 'biotech',
  Diagnosis: 'medical_information',
  Vaccination: 'vaccines',
  Imaging: 'radiology',
  'Discharge Summary': 'summarize',
  Other: 'description',
}

const emptyForm = {
  title: '',
  type: 'Other',
  date: getLocalDateString(),
  description: '',
  diagnosis: '',
  medications: [],
}

export default function MedicalRecords() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [medName, setMedName] = useState('')
  const [medDosage, setMedDosage] = useState('')
  const [medFrequency, setMedFrequency] = useState('')
  const [medDuration, setMedDuration] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [selectedRecord, setSelectedRecord] = useState(null)

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/records/my', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setRecords(data.records || [])
    } catch (err) {
      console.error('Error fetching records:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords()
  }, [])

  const handleAddMedication = () => {
    if (!medName.trim()) return
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { name: medName, dosage: medDosage, frequency: medFrequency, duration: medDuration }]
    }))
    setMedName(''); setMedDosage(''); setMedFrequency(''); setMedDuration('')
  }

  const removeMed = (i) => {
    setFormData(prev => ({ ...prev, medications: prev.medications.filter((_, idx) => idx !== i) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.date) return
    setIsSaving(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5000/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.success) {
        setRecords(prev => [data.record, ...prev])
        setShowForm(false)
        setFormData(emptyForm)
        setMessage({ type: 'success', text: 'Record added successfully!' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      } else {
        setMessage({ type: 'error', text: data.message })
      }
    } catch {
      setMessage({ type: 'error', text: 'Error saving record' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medical record?')) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/records/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setRecords(prev => prev.filter(r => (r._id || r.id) !== id))
        if (selectedRecord && (selectedRecord._id || selectedRecord.id) === id) setSelectedRecord(null)
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const filtered = records.filter(r => {
    const matchType = filter === 'All' || r.type === filter
    const matchSearch = search === '' ||
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.type?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 md:p-8 ml-0 md:ml-64 transition-all duration-300" id="medical-records">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Medical Records</h1>
            <p className="mt-1 text-base text-navy-muted">View and manage your personal health records.</p>
          </div>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            onClick={() => { setShowForm(true); setFormData(emptyForm) }}
          >
            <span className="material-icons-outlined text-[18px]">add</span>
            Add Record
          </button>
        </div>

        {/* Toast message */}
        {message.text && (
          <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-2.5 border-[1.5px] border-slate-300 rounded-xl bg-white flex-1">
            <span className="material-icons-outlined text-outline text-[20px]">search</span>
            <input
              type="text"
              placeholder="Search records by title, type..."
              className="flex-1 border-none outline-none text-sm text-on-surface bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {RECORD_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${filter === t ? 'bg-primary text-white border-primary' : 'bg-white text-navy-muted border-slate-200 hover:border-primary hover:text-primary'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Records', value: records.length, icon: 'folder_open', color: 'text-primary' },
            { label: 'Prescriptions', value: records.filter(r => r.type === 'Prescription').length, icon: 'medication', color: 'text-blue-600' },
            { label: 'Lab Reports', value: records.filter(r => r.type === 'Lab Report').length, icon: 'biotech', color: 'text-purple-600' },
            { label: 'Diagnoses', value: records.filter(r => r.type === 'Diagnosis').length, icon: 'medical_information', color: 'text-red-500' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-outline-variant shadow-sm">
              <span className={`material-icons-outlined ${stat.color} text-[28px]`}>{stat.icon}</span>
              <div>
                <p className="text-2xl font-bold text-navy">{stat.value}</p>
                <p className="text-xs text-navy-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Records list / Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1">
          
          {/* Records List */}
          <div>
            {loading ? (
              <div className="text-center p-12 text-navy-muted">Loading records...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-dashed border-slate-300">
                <span className="material-icons-outlined text-[48px] text-outline mb-3">folder_open</span>
                <h3 className="text-lg font-semibold text-navy mb-1">No records found</h3>
                <p className="text-sm text-navy-muted mb-4">
                  {search || filter !== 'All' ? 'Try adjusting your search or filter.' : 'Add your first medical record to get started.'}
                </p>
                {!search && filter === 'All' && (
                  <button
                    className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
                    onClick={() => setShowForm(true)}
                  >
                    Add First Record
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(record => {
                  const id = record._id || record.id
                  const isSelected = selectedRecord && (selectedRecord._id || selectedRecord.id) === id
                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedRecord(isSelected ? null : record)}
                      className={`cursor-pointer p-5 bg-white rounded-xl border transition-all hover:shadow-md ${isSelected ? 'border-primary shadow-md' : 'border-outline-variant'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[record.type] || typeColors['Other']}`}>
                            <span className="material-icons-outlined text-[20px]">{typeIcons[record.type] || 'description'}</span>
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-navy leading-tight">{record.title}</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${typeColors[record.type] || typeColors['Other']}`}>{record.type}</span>
                              <span className="text-xs text-navy-muted">{record.date}</span>
                              {record.addedBy === 'doctor' && (
                                <span className="text-xs text-primary font-medium">· By Doctor</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(id) }}
                            className="p-1.5 text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <span className="material-icons-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                      {record.description && (
                        <p className="mt-2 ml-[52px] text-sm text-navy-muted line-clamp-2">{record.description}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div>
            {selectedRecord ? (
              <div className="sticky top-6 bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                <div className={`p-5 flex items-center gap-3 border-b border-outline-variant ${typeColors[selectedRecord.type] || typeColors['Other']}`}>
                  <span className="material-icons-outlined text-[24px]">{typeIcons[selectedRecord.type] || 'description'}</span>
                  <div>
                    <h3 className="text-base font-semibold">{selectedRecord.title}</h3>
                    <p className="text-xs opacity-80">{selectedRecord.type} · {selectedRecord.date}</p>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  {selectedRecord.addedBy === 'doctor' && (
                    <div className="flex items-center gap-2 text-xs text-primary bg-primary-fixed rounded-lg px-3 py-2">
                      <span className="material-icons-outlined text-[16px]">verified_user</span>
                      Added by your doctor
                    </div>
                  )}
                  {selectedRecord.diagnosis && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">Diagnosis</p>
                      <p className="text-sm text-navy">{selectedRecord.diagnosis}</p>
                    </div>
                  )}
                  {selectedRecord.description && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-1">Description</p>
                      <p className="text-sm text-navy leading-relaxed">{selectedRecord.description}</p>
                    </div>
                  )}
                  {selectedRecord.medications?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-2">Medications</p>
                      <div className="flex flex-col gap-2">
                        {selectedRecord.medications.map((med, i) => (
                          <div key={i} className="p-3 bg-surface rounded-xl border border-outline-variant text-sm">
                            <p className="font-semibold text-navy">{med.name}</p>
                            <div className="flex gap-3 mt-1 text-xs text-navy-muted flex-wrap">
                              {med.dosage && <span>Dosage: {med.dosage}</span>}
                              {med.frequency && <span>· {med.frequency}</span>}
                              {med.duration && <span>· {med.duration}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center bg-white rounded-xl border border-dashed border-slate-200 text-navy-muted">
                <span className="material-icons-outlined text-[36px] mb-2">touch_app</span>
                <p className="text-sm">Click on a record to view its details</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Record Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white flex justify-between items-center p-5 border-b border-outline-variant z-10">
                <h2 className="text-xl font-semibold text-navy">Add Medical Record</h2>
                <button onClick={() => setShowForm(false)} className="text-outline hover:text-navy">
                  <span className="material-icons-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Title *</label>
                  <input
                    required
                    className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-sm focus:border-primary outline-none"
                    placeholder="e.g. Blood Test Report June 2025"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-navy">Type *</label>
                    <select
                      className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-sm focus:border-primary outline-none bg-white"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      {RECORD_TYPES.filter(t => t !== 'All').map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-navy">Date *</label>
                    <input
                      type="date"
                      required
                      className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-sm focus:border-primary outline-none"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Diagnosis</label>
                  <input
                    className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-sm focus:border-primary outline-none"
                    placeholder="e.g. Type 2 Diabetes"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-navy">Description / Notes</label>
                  <textarea
                    className="w-full p-3 border-[1.5px] border-slate-300 rounded-xl text-sm focus:border-primary outline-none"
                    rows="3"
                    placeholder="Additional notes about this record..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Medications */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-navy">Medications</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="p-2 border-[1.5px] border-slate-300 rounded-lg text-sm outline-none focus:border-primary" placeholder="Medicine name" value={medName} onChange={(e) => setMedName(e.target.value)} />
                    <input className="p-2 border-[1.5px] border-slate-300 rounded-lg text-sm outline-none focus:border-primary" placeholder="Dosage (e.g. 500mg)" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} />
                    <input className="p-2 border-[1.5px] border-slate-300 rounded-lg text-sm outline-none focus:border-primary" placeholder="Frequency (e.g. Twice daily)" value={medFrequency} onChange={(e) => setMedFrequency(e.target.value)} />
                    <input className="p-2 border-[1.5px] border-slate-300 rounded-lg text-sm outline-none focus:border-primary" placeholder="Duration (e.g. 7 days)" value={medDuration} onChange={(e) => setMedDuration(e.target.value)} />
                  </div>
                  <button type="button" onClick={handleAddMedication} className="self-start text-sm text-primary font-medium hover:underline">
                    + Add Medication
                  </button>
                  {formData.medications.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {formData.medications.map((med, i) => (
                        <div key={i} className="flex justify-between items-center p-2.5 bg-surface rounded-lg border border-outline-variant text-sm">
                          <span className="font-medium text-navy">{med.name} <span className="text-navy-muted font-normal">— {med.dosage} · {med.frequency} · {med.duration}</span></span>
                          <button type="button" onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600 ml-2">
                            <span className="material-icons-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 mt-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save Record'}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="mt-auto pt-12 -mx-6 md:-mx-8 -mb-6 md:-mb-8">
          <Footer />
        </div>
      </main>
    </div>
  )
}
