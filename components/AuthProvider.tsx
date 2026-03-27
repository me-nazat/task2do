'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthReady } = useStore();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
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
      });
  }, [setUser, setAuthReady]);

  return <>{children}</>;
}
