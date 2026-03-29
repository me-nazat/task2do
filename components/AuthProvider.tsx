'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthReady, user } = useStore();

  useEffect(() => {
    // Skip if we already have a user and auth is ready
    if (user && setAuthReady) {
      setAuthReady(true);
      return;
    }

    const checkAuthStatus = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            displayName: data.user.name,
          });
        } else {
          setUser(null);
        }
        setAuthReady(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
        setAuthReady(true);
      }
    };

    checkAuthStatus();
  }, [setUser, setAuthReady, user]);

  return <>{children}</>;
}
