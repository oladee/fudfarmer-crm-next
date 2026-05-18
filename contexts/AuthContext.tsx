
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType } from '../types';
import { useWhoAmI } from '@/hooks/useQueries';
import { useNavigate } from 'react-router-dom';
import { axiosPost } from '@/lib/api';

export enum ValidUserRole{
  sales_agent = "sales agent",
  admin  = "admin"
}

export interface IUser {
  _id : string
  full_name: string;
  email: string;
  phone: string;
  role: ValidUserRole;
  location: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [localUser, setLocalUser] = useState<IUser | null>(null);
  const [prevState, setPrevState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const navigate = useNavigate();

  const {
    data : user,
    isLoading,
    isRefetching,
    isError,
    refetch
  } = useWhoAmI();
  

  useEffect(() => {
    if (user){
      setLoading(false)
      setLocalUser(user); // sync when fetched
    }
    if(isError){
      setLoading(false)
    }
  }, [user,isError]);


  const login = async (user :  IUser) => {
    setLocalUser(user)
    await refetch()
    navigate(prevState ?? "/", { replace: true });
  };

  const logout = async () => {
    await axiosPost('auth/logout',{}, true)
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login,isRefetching, logout,loading: loading,
        error : isError, isAuthenticated: !!user,refetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
