import { Routes, Route, Navigate } from 'react-router-dom'
import { ProfileProvider } from './profile'
import Header from './components/Header'
import Home from './pages/Home'
import JobDetail from './pages/JobDetail'

export default function App() {
  return (
    <ProfileProvider>
      <div className="min-h-screen bg-bg text-fg">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ProfileProvider>
  )
}
