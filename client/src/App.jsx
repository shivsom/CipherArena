import { Navigate, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Challenges from './pages/Challenges'
import Leaderboard from './pages/Leaderboard'
import Premium from './pages/Premium'

function Private({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <p className="muted center">Loading…</p>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/challenges" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/challenges" element={<Private><Challenges /></Private>} />
          <Route path="/premium" element={<Private><Premium /></Private>} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
    </>
  )
}
