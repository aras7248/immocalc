'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { isPublicRoute } from '@/lib/publicRoutes';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Validate the user with Supabase Auth instead of trusting local storage alone.
    const checkSession = async () => {
      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      
      if (authenticatedUser) {
        setUser(authenticatedUser);
      } else {
        setUser(null);
        // Force redirect to login if not already there
        if (!isPublicRoute(pathname)) {
          router.replace('/login');
        }
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          if (pathname === '/login') {
            router.replace('/');
          }
        } else {
          setUser(null);
          if (!isPublicRoute(pathname)) {
            router.replace('/login');
          }
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {/* Show a very simple loading state to prevent flash of content */}
      {loading ? (
        <div className="auth-loading" role="status" aria-live="polite">
          <div className="spinner-small" style={{ width: '2rem', height: '2rem' }} aria-hidden="true" />
          <span className="sr-only">Sitzung wird geprüft …</span>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

