import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AnimatePresence } from 'framer-motion'

// Public Pages
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const DoctorListing = lazy(() => import('./pages/DoctorListing'))
const DoctorProfile = lazy(() => import('./pages/DoctorProfile'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))

// Protected Pages
const BookAppointment = lazy(() => import('./pages/BookAppointment'))
const MyAppointments = lazy(() => import('./pages/MyAppointments'))
const PatientProfile = lazy(() => import('./pages/PatientProfile'))
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'))
const ManageAppointments = lazy(() => import('./pages/ManageAppointments'))
const SetAvailability = lazy(() => import('./pages/SetAvailability'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const Messages = lazy(() => import('./pages/Messages'))
const DoctorProfileSettings = lazy(() => import('./pages/DoctorProfileSettings'))
const MedicalRecords = lazy(() => import('./pages/MedicalRecords'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminAppointments = lazy(() => import('./pages/AdminAppointments'))
const AdminRecords = lazy(() => import('./pages/AdminRecords'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminDoctors = lazy(() => import('./pages/AdminDoctors'))

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      <p className="text-navy-muted text-sm">Loading...</p>
    </div>
  </div>
)

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth()

  // Wait for auth check to complete before redirecting
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-navy-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their respective dashboard if they don't have permission
    if (user.role === 'doctor') return <Navigate to="/doctor/dashboard" replace />
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
    return <Navigate to="/patient/appointments" replace />
  }

  return children
}

// Admin-specific protected route
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-navy-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  if (user.role !== 'admin') return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  const location = useLocation()

  return (
    <Suspense fallback={<LoadingScreen />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/doctors" element={<DoctorListing />} />
        <Route path="/doctors/:id" element={<DoctorProfile />} />

        {/* Protected Routes - Patient */}
        <Route path="/book/:id" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <BookAppointment />
          </ProtectedRoute>
        } />
        <Route path="/patient/appointments" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <MyAppointments />
          </ProtectedRoute>
        } />
        <Route path="/patient/profile" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientProfile />
          </ProtectedRoute>
        } />
        <Route path="/patient/records" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <MedicalRecords />
          </ProtectedRoute>
        } />
        <Route path="/patient/messages" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <Messages />
          </ProtectedRoute>
        } />

        {/* Protected Routes - Doctor */}
        <Route path="/doctor/dashboard" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/doctor/appointments" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <ManageAppointments />
          </ProtectedRoute>
        } />
        <Route path="/doctor/availability" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <SetAvailability />
          </ProtectedRoute>
        } />
        <Route path="/doctor/profile" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorProfileSettings />
          </ProtectedRoute>
        } />
        <Route path="/doctor/messages" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <Messages />
          </ProtectedRoute>
        } />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/appointments" element={<AdminRoute><AdminAppointments /></AdminRoute>} />
        <Route path="/admin/records" element={<AdminRoute><AdminRecords /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/doctors" element={<AdminRoute><AdminDoctors /></AdminRoute>} />
        <Route path="/admin/messages" element={<AdminRoute><Messages /></AdminRoute>} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  )
}
