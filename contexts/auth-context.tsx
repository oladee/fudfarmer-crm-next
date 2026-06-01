'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Agent, AuthContextType } from '../types';
import { StorageService } from '../lib/storage-service';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Agent | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem('fudfarmer_user_id');
    if (storedUserId) {
      const agents = StorageService.getAgents();
      const found = agents.find((a) => a.id === storedUserId);
      if (found) setUser(found);
    }
  }, []);

  const login = async (agentId: string, password: string) => {
    const agents = StorageService.getAgents();
    const agent = agents.find((a) => a.id === agentId);
    const actualPassword = agent?.password || 'password';

    if (agent && password === actualPassword) {
      setUser(agent);
      localStorage.setItem('fudfarmer_user_id', agent.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fudfarmer_user_id');
  };

  const updateProfile = async (updates: Partial<Agent>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    const agents = StorageService.getAgents();
    const updatedAgents = agents.map((a) => (a.id === user.id ? updatedUser : a));
    StorageService.saveAgents(updatedAgents);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
