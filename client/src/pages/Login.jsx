import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    try {
      await login(email, password)         // POST /api/auth/login via Axios
      navigate('/challenges')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h2>Player login</h2>
      {error && <div className="alert error">{error}</div>}
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className="btn">Login</button>
      <p className="muted small">New here? <Link to="/register">Create an account</Link></p>
    </form>
  )
}
