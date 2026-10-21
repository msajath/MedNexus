import { useCallback, useEffect, useState } from 'react'
import { API_BASE, apiFetchJson } from '../config'

const recoveryDelay = 15000
const maximumRecoveryChecks = 1
const transientStatuses = new Set([502, 503, 504])
const unavailableMessage = 'We couldn’t load the doctors right now. Please try again shortly.'

const isTransient = error => transientStatuses.has(error?.status)
  || error instanceof TypeError
  || error?.code === 'API_TIMEOUT'
  || error?.name === 'TimeoutError'

// Keep the last successful list in memory while reconnecting. Booking availability
// is always checked by its own endpoint; this hook never caches appointment slots.
export default function useDoctors() {
  const [state, setState] = useState({ doctors: [], loading: true, error: null, retrying: false })
  const [request, setRequest] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let recoveryTimer
    let recoveryChecks = 0

    const loadDoctors = async () => {
      try {
        const payload = await apiFetchJson(`${API_BASE}/api/doctors`, { signal: controller.signal })
        const doctors = Array.isArray(payload) ? payload : payload?.doctors
        if (!Array.isArray(doctors) || doctors.some(doctor => (
          !doctor || typeof doctor !== 'object' || typeof doctor.name !== 'string'
          || typeof (doctor._id || doctor.id) !== 'string'
          || (doctor.specialty != null && typeof doctor.specialty !== 'string')
          || (doctor.location != null && typeof doctor.location !== 'string')
        ))) throw new Error('Invalid doctor list')
        if (controller.signal.aborted) return
        setState({ doctors, loading: false, error: null, retrying: false })
      } catch (error) {
        if (controller.signal.aborted) return
        if (isTransient(error) && recoveryChecks < maximumRecoveryChecks) {
          recoveryChecks += 1
          setState(previous => ({ ...previous, loading: false, error: null, retrying: true }))
          recoveryTimer = setTimeout(loadDoctors, recoveryDelay)
        } else {
          setState(previous => ({ ...previous, loading: false, error: unavailableMessage, retrying: false }))
        }
      }
    }

    loadDoctors()
    return () => {
      controller.abort()
      clearTimeout(recoveryTimer)
    }
  }, [request])

  const retry = useCallback(() => {
    setState(previous => ({ ...previous, loading: true, error: null, retrying: false }))
    setRequest(previous => previous + 1)
  }, [])

  return { ...state, retry }
}
