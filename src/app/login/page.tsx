'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // If successful, the AuthContext will automatically redirect to '/'
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '24px',
        padding: '2rem',
        boxShadow: 'var(--glass-shadow)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        textAlign: 'center'
      }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <img
            src="/logos/immocow-full-light-v2.png"
            alt="ImmoCow"
            style={{ height: 92, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        <h1 style={{ fontFamily: 'Outfit, Inter, sans-serif', fontSize: '1.55rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          ImmoCalc
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Melde dich an, um auf ImmoCalc und deine gespeicherten Objekte zuzugreifen.
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="input-wrapper" style={{ flex: 1 }}>
            <input
              type="email"
              placeholder="E-Mail Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '0.9rem', fontSize: '1rem' }}
            />
          </div>

          <div className="input-wrapper" style={{ flex: 1 }}>
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ padding: '0.9rem', fontSize: '1rem' }}
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'left', padding: '0 0.5rem' }}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{
              background: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {loading ? <div className="spinner-small"></div> : 'Einloggen'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.55 }}>
          Teil der ImmoCow Familie
        </div>
      </div>
    </div>
  );
}
