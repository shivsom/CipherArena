import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

// Razorpay Checkout is loaded on demand so it is not part of the main bundle
function loadCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = resolve
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout – check your connection'))
    document.body.appendChild(s)
  })
}

export default function Premium() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/premium/status').then(res => setInfo(res.data)).catch(err => setError(err.message))
  }, [])

  const unlock = async () => {
    setError('')
    setBusy(true)
    try {
      const { data: order } = await api.post('/premium/order')       // 1. server creates a Razorpay order
      await loadCheckout()
      const rzp = new window.Razorpay({                              // 2. player pays in Razorpay Checkout
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'CipherArena',
        description: 'Premium Vault – lifetime access',
        prefill: { name: order.name, email: order.email },
        theme: { color: '#22e38a' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (response) => {                               // 3. server verifies the signature
          try {
            await api.post('/premium/verify', response)
            setUser(u => ({ ...u, premium: true }))
            navigate('/challenges')
          } catch (err) {
            setError(err.message)
            setBusy(false)
          }
        },
      })
      rzp.on('payment.failed', r => { setError(r.error?.description || 'Payment failed'); setBusy(false) })
      rzp.open()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (!info) return error ? <div className="alert error">{error}</div> : <p className="muted center">Loading…</p>

  return (
    <section className="premium">
      <div className="premium-card">
        <span className="tag-premium">PREMIUM VAULT</span>
        <h1>Unlock the hardest challenges</h1>
        <p className="muted">
          {info.challenges} expert-level challenges worth <b className="neon">{info.points}</b> points — steganography,
          RSA attacks, DNS exfiltration and a table-driven crackme. One payment, access for life.
        </p>
        <ul className="perks">
          <li>Zero-width text forensics, LSB image steganography</li>
          <li>RSA with weak primes, DNS exfiltration capture</li>
          <li>Rotor Lock — the toughest reverse engineering challenge</li>
          <li>Points count on the global leaderboard</li>
        </ul>
        {error && <div className="alert error">{error}</div>}
        {info.premium ? (
          <>
            <div className="msg ok">✔ You own the Premium Vault</div>
            <Link to="/challenges" className="btn btn-block">Go to the vault</Link>
          </>
        ) : (
          <>
            <div className="price">₹{info.priceInr}<span className="muted small"> one-time</span></div>
            <button className="btn btn-block" onClick={unlock} disabled={busy || !info.paymentsEnabled}>
              {busy ? 'Opening Razorpay…' : 'Pay with Razorpay'}
            </button>
            {!info.paymentsEnabled && <p className="muted small">Payments are not enabled on this server yet.</p>}
            <p className="muted small">Secure checkout by Razorpay · UPI, cards, netbanking, wallets</p>
          </>
        )}
      </div>
    </section>
  )
}
