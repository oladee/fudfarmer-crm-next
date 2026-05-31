'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContextType } from '@/types';
import { useWhoAmI } from '@/hooks/use-queries';
import { axiosPost } from '@/lib/api';
import { clearSessionMarker, setSessionMarker } from '@/lib/session-marker';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const {
    data: user,
    isError,
    refetch,
  } = useWhoAmI();

  useEffect(() => {
    if (user || isError) setLoading(false);
  }, [user, isError]);

  useEffect(() => {
    if (user) setSessionMarker();
    else if (isError) clearSessionMarker();
  }, [user, isError]);

  const login = async (email: string, password: string) => {
    await axiosPost('auth/login', { email, password }, true);
    const result = await refetch();
    if (result.data) {
      setSessionMarker();
      router.replace('/');
    }
  };

  const logout = async () => {
    clearSessionMarker();
    await axiosPost('auth/logout', {}, true);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
        error: isError,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
