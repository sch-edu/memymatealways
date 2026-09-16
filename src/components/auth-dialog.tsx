import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, UserPlus, X } from 'lucide-react';
import { firebaseConfigured, signInWithEmail, signUpWithEmail } from '@/lib/firebase';
import { playSound } from '@/lib/sounds';

export type AuthMode = 'signin' | 'signup';

type AuthDialogProps = {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
};

function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password combination did not match an account.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email — try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 6 characters).';
    case 'auth/invalid-email':
      return 'That email address does not look valid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network problem — check your connection and retry.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is not enabled for this Firebase project yet.';
    default:
      return error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.';
  }
}

/**
 * Email/password sign-in & sign-up modal with guest mode support.
 * Guests keep everything on-device; only real accounts sync to Firestore.
 */
export function AuthDialog({ open, mode, onClose, onModeChange }: AuthDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    playSound('click');
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Passwords need at least 6 characters.');
      return;
    }
    if (!firebaseConfigured) {
      setError('Cloud accounts are unavailable — add the Firebase web config for this deployment.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await signUpWithEmail(trimmedEmail, password);
      else await signInWithEmail(trimmedEmail, password);
      playSound('levelup');
      onClose();
    } catch (submitError) {
      setError(friendlyAuthError(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signup' ? 'Create your MeMyMate account' : 'Sign in to MeMyMate'}
      data-testid="dialog-auth"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="auth-panel">
        <div className="auth-head">
          <span className="auth-logo-chip" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}arct-logo.png`} alt="" />
          </span>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close sign-in dialog" data-testid="button-close-auth">
            <X size={16} />
          </button>
        </div>
        <h2 className="auth-title">{mode === 'signup' ? 'Create your free account' : 'Welcome back'}</h2>
        <p className="auth-sub">
          Email accounts unlock cloud sync and public share links. Guests keep every Knight on this device — no cloud traffic at all.
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
            onClick={() => onModeChange('signin')}
            data-testid="button-auth-signin-tab"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
            onClick={() => onModeChange('signup')}
            data-testid="button-auth-signup-tab"
          >
            Create account
          </button>
        </div>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoFocus
              data-testid="input-auth-email"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap">
              <input
                id="auth-password"
                className="input"
                type={revealPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                data-testid="input-auth-password"
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setRevealPassword((current) => !current)}
                aria-label={revealPassword ? 'Hide password' : 'Show password'}
              >
                {revealPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {error && (
            <p className="auth-error" role="alert" data-testid="status-auth-error">
              {error}
            </p>
          )}
          <div className="form-footer" style={{ marginTop: 16 }}>
            <button type="button" className="button button-ghost" onClick={onClose} data-testid="button-continue-guest">
              Continue as guest
            </button>
            <button type="submit" className="button button-primary" disabled={busy} data-testid="button-auth-submit">
              {mode === 'signup' ? (
                <>
                  <UserPlus size={15} /> {busy ? 'Creating…' : 'Create account'}
                </>
              ) : (
                <>
                  <LogIn size={15} /> {busy ? 'Signing in…' : 'Sign in'}
                </>
              )}
            </button>
          </div>
        </form>
        <div className="auth-divider">or</div>
        <p className="auth-note">
          <strong>Guest mode:</strong> flashcards are stored locally in this browser (localStorage) with zero Firestore I/O. Sharing a
          Knight and syncing across devices need a free account.
        </p>
        {!firebaseConfigured && (
          <p className="auth-error" style={{ marginTop: 10 }}>
            Firebase is not configured for this deployment — guest mode still works perfectly.
          </p>
        )}
      </div>
    </div>
  );
}
