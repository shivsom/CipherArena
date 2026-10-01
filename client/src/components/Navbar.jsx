import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  return (
    <header className="navbar">
      <Link to="/" className="brand">◆ Cipher<span>Arena</span></Link>
      <nav>
        <NavLink to="/challenges">Challenges</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
      </nav>
      <div className="user">
        {user ? (
          <>
            <span className="chip">{user.team} · <b>{user.score}</b> pts</span>
            <button className="link" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register" className="btn-sm">Register</NavLink>
          </>
        )}
      </div>
    </header>
  )
}
