import { useEffect, useState } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function Challenges() {
  const { user, setUser } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flags, setFlags] = useState({})       // flag text per challenge id
  const [results, setResults] = useState({})   // server message per challenge id

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

  if (loading) return <p className="muted center">Loading challenges from the API…</p>
  if (error) return <div className="alert error">{error}</div>

  const solvedCount = challenges.filter(c => c.solved).length
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Challenges</h1>
          <p className="muted">Welcome {user.username} — {solvedCount}/{challenges.length} solved · {user.score} points</p>
        </div>
      </div>
      <div className="grid">
        {challenges.map(c => (
          <article key={c._id} className={`card ${c.solved ? 'solved' : ''}`}>
            <div className="card-top"><span className={`badge ${c.category}`}>{c.category}</span><b className="pts">{c.points}</b></div>
            <h3>{c.title}</h3>
            <p className="desc">{c.description}</p>
            <p className="muted small">{c.solves} {c.solves === 1 ? 'solve' : 'solves'}</p>
            {c.solved ? (
              <div className="msg ok">✔ Solved</div>
            ) : (
              <form className="flag-form" onSubmit={e => { e.preventDefault(); submitFlag(c._id) }}>
                <input placeholder="CA{...}" value={flags[c._id] || ''}
                  onChange={e => setFlags({ ...flags, [c._id]: e.target.value })} />
                <button className="btn">Submit</button>
              </form>
            )}
            {results[c._id] && <div className={`msg ${results[c._id].ok ? 'ok' : 'bad'}`}>{results[c._id].text}</div>}
          </article>
        ))}
      </div>
    </section>
  )
}
