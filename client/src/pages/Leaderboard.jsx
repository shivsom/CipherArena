import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../api/config'

// This page uses the native Fetch API instead of Axios
export default function Leaderboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/leaderboard`, { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then(data => { setRows(data); setStatus('ok') })
      .catch(err => { if (err.name !== 'AbortError') setStatus(err.message) })
    return () => controller.abort()          // cancel the request if the page unmounts
  }, [])

  if (status === 'loading') return <p className="muted center">Loading leaderboard…</p>
  if (status !== 'ok') return <div className="alert error">{status}</div>
  const top = rows[0]?.score || 1

  return (
    <section>
      <div className="page-head"><h1>Leaderboard</h1><span className="muted">GET /api/leaderboard · Fetch API · MongoDB aggregation</span></div>
      <table className="board">
        <thead><tr><th>#</th><th>Player</th><th>Team</th><th>Solves</th><th>Score</th><th></th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id} className={user && r._id === user.id ? 'me' : ''}>
              <td>{r.rank}</td>
              <td>{r.username}{user && r._id === user.id && <span className="you">you</span>}</td>
              <td className="mono">{r.team}</td>
              <td>{r.solves}</td>
              <td className="mono neon">{r.score}</td>
              <td className="barcell"><div className="bar"><div style={{ width: `${(r.score / top) * 100}%` }} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
