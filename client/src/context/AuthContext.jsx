import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // on page load: restore the session from the saved token
  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('ca:logout', onLogout)
    if (localStorage.getItem('ca_token')) {
      api.get('/auth/me').then(res => setUser(res.data)).catch(() => {}).finally(() => setReady(true))
    } else setReady(true)
    return () => window.removeEventListener('ca:logout', onLogout)
  }, [])

  const saveSession = ({ token, user }) => { localStorage.setItem('ca_token', token); setUser(user) }
  const login = async (email, password) => saveSession((await api.post('/auth/login', { email, password })).data)
  const register = async (form) => saveSession((await api.post('/auth/register', form)).data)
  const logout = () => { localStorage.removeItem('ca_token'); setUser(null) }

  return (
    <AuthContext.Provider value={{ user, setUser, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
