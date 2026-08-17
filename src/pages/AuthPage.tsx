import { ArrowRight, LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ErrorMessage } from '../components/Ui'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    const result = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) setError(result.error.message)
    else if (isSignUp) setMessage('Check your email to confirm your account, then sign in.')
    setSubmitting(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand brand--light">Marketeers <span>Club</span></div>
        <div>
          <p className="eyebrow">Merchandise, moving together</p>
          <h1>Clear terms.<br />Smooth handoffs.</h1>
          <p>Coordinate sales trips with friends, agree on every detail, and settle without guesswork.</p>
        </div>
        <div className="auth-story__steps">
          <span>01 Share a trip</span>
          <span>02 Agree on terms</span>
          <span>03 Settle inventory</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-icon"><LockKeyhole /></div>
          <p className="eyebrow">Member access</p>
          <h2>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
          <p>{isSignUp ? 'Start coordinating with your selling team.' : 'Your team trips and inventory are waiting.'}</p>

          {!isSupabaseConfigured && (
            <ErrorMessage message="Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env for local development, or as build variables on your host, then rebuild." />
          )}
          {error && <ErrorMessage message={error} />}
          {message && <div className="alert alert--success">{message}</div>}

          <form onSubmit={(event) => void handleSubmit(event)}>
            {isSignUp && (
              <label>
                Display name
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} autoComplete="name" />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} />
            </label>
            <button className="button button--primary button--full" disabled={submitting || !isSupabaseConfigured}>
              {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
              {!submitting && <ArrowRight size={18} />}
            </button>
          </form>

          <button className="text-button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}>
            {isSignUp ? 'Already a member? Sign in' : 'New here? Create an account'}
          </button>
        </div>
      </section>
    </main>
  )
}