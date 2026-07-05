'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setConfirmSent(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ color: '#F2B705' }}>RMT</span>
          <span style={{ color: '#ffffff' }}>rading Cards</span>
        </h1>

        <div style={{ backgroundColor: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '2rem' }}>
          {confirmSent ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                Check your email
              </h2>
              <p style={{ color: '#9ca3af', fontSize: 14 }}>
                We sent a confirmation link to <span style={{ color: '#ffffff' }}>{email}</span>.
                Click it, then come back and log in.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                Create Account
              </h2>

              <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  style={{
                    backgroundColor: '#0d0d0d',
                    border: '1px solid #2a2a2a',
                    color: '#ffffff',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password (6+ characters)"
                  required
                  style={{
                    backgroundColor: '#0d0d0d',
                    border: '1px solid #2a2a2a',
                    color: '#ffffff',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                  }}
                />

                {error && (
                  <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: '#F2B705',
                    color: '#000000',
                    fontWeight: 700,
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 14,
                    border: 'none',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    marginTop: 4,
                  }}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 16 }}>
                Already have an account?{' '}
                <a href="/login" style={{ color: '#F2B705', textDecoration: 'none' }}>
                  Log in
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
