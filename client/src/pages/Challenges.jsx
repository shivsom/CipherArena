import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

// Read the file name the server sent in "Content-Disposition: attachment; filename=..."
const fileNameFrom = (res, fallback) => /filename="?([^";]+)"?/.exec(res.headers['content-disposition'] || '')?.[1] || fallback

export default function Challenges() {
  const { user, setUser } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flags, setFlags] = useState({})       // flag text per challenge id
  const [results, setResults] = useState({})   // server message per challenge id
  const [hints, setHints] = useState({})       // which hints are open

  // GET /api/challenges when the page mounts
  useEffect(() => {
    api.get('/challenges')
      .then(res => setChallenges(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const submitFlag = async (id) => {
    try {
      const { data } = await api.post(`/challenges/${id}/submit`, { flag: flags[id] || '' })
      setResults(r => ({ ...r, [id]: { ok: true, text: data.message } }))
      setChallenges(list => list.map(c => (c._id === id ? { ...c, solved: true, solves: c.solves + 1 } : c)))
      setUser(u => ({ ...u, score: data.score }))
    } catch (err) {
      setResults(r => ({ ...r, [id]: { ok: false, text: `${err.response?.status} · ${err.message}` } }))
    }
  }

  // the file route needs the JWT header, so fetch it as a blob and hand it to the browser
  const download = async (c) => {
    try {
      const res = await api.get(`/challenges/${c._id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileNameFrom(res, c.title)
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setResults(r => ({ ...r, [c._id]: { ok: false, text: `Download failed · ${err.message}` } }))
    }
  }

  if (loading) return <p className="muted center">Loading challenges from the API…</p>
  if (error) return <div className="alert error">{error}</div>

  const free = challenges.filter(c => c.room !== 'premium')
  const vault = challenges.filter(c => c.room === 'premium')
  const solvedCount = challenges.filter(c => c.solved).length

  const card = (c) => (
    <article key={c._id} className={`card ${c.solved ? 'solved' : ''} ${c.locked ? 'locked' : ''}`}>
      <div className="card-top"><span className={`badge ${c.category}`}>{c.category}</span><b className="pts">{c.points}</b></div>
      <h3>{c.locked && '🔒 '}{c.title}</h3>
      <p className="desc">{c.description}</p>
      <p className="muted small">{c.solves} {c.solves === 1 ? 'solve' : 'solves'}</p>
      {c.locked ? (
        <Link to="/premium" className="btn btn-block">Unlock Premium Vault</Link>
      ) : (
        <>
          {c.hasFile && <button type="button" className="btn-ghost" onClick={() => download(c)}>⬇ Download challenge file</button>}
          {c.hint && (
            <button type="button" className="link small left" onClick={() => setHints(h => ({ ...h, [c._id]: !h[c._id] }))}>
              {hints[c._id] ? 'Hide hint' : 'Show hint'}
            </button>
          )}
          {hints[c._id] && <p className="hint">{c.hint}</p>}
          {c.solved ? (
            <div className="msg ok">✔ Solved</div>
          ) : (
            <form className="flag-form" onSubmit={e => { e.preventDefault(); submitFlag(c._id) }}>
              <input placeholder="CA{...}" value={flags[c._id] || ''}
                onChange={e => setFlags({ ...flags, [c._id]: e.target.value })} />
              <button className="btn">Submit</button>
            </form>
          )}
        </>
      )}
      {results[c._id] && <div className={`msg ${results[c._id].ok ? 'ok' : 'bad'}`}>{results[c._id].text}</div>}
    </article>
  )

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Challenges</h1>
          <p className="muted">Welcome {user.username} — {solvedCount}/{challenges.length} solved · {user.score} points</p>
        </div>
      </div>

      <h2 className="room-title">Free Arena <span className="muted small">download the file, find the flag, submit it</span></h2>
      <div className="grid">{free.map(card)}</div>

      {vault.length > 0 && (
        <>
          <div className="room-head">
            <h2 className="room-title">Premium Vault <span className="tag-premium">{user.premium ? 'UNLOCKED' : 'PREMIUM'}</span></h2>
            {!user.premium && <Link to="/premium" className="btn">Unlock with Razorpay</Link>}
          </div>
          <div className="grid">{vault.map(card)}</div>
        </>
      )}
    </section>
  )
}
