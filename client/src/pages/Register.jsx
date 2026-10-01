import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', team: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = e => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await register(form)                 // POST /api/auth/register via Axios
      navigate('/challenges')
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h2>Create your player account</h2>
      <p className="muted">Data is stored in MongoDB through the Express API.</p>
      {error && <div className="alert error">{error}</div>}
      <label>Username<input name="username" value={form.username} onChange={update} /></label>
      <label>Email<input name="email" type="email" value={form.email} onChange={update} /></label>
      <label>Team name<input name="team" value={form.team} onChange={update} /></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={update} /></label>
      <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Register'}</button>
      <p className="muted small">Already registered? <Link to="/login">Log in</Link></p>
    </form>
  )
}
