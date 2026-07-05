'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else router.push('/collection')
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto' }}>
      <h1>Create Account</h1>
      <form onSubmit={handleSignUp}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ padding: 8, width: '100%' }}>Create Account</button>
      </form>
      <p style={{ marginTop: 12 }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </div>
  )
}