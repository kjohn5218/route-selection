import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useAuth } from './AuthContext';

interface Terminal {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface TerminalContextType {
  terminals: Terminal[];
  selectedTerminal: Terminal | null;
  setSelectedTerminal: (terminal: Terminal | null) => void;
  isLoading: boolean;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);

  // Fetch terminals accessible by current user
  const { data: terminals = [], isLoading } = useQuery<Terminal[]>({
    queryKey: ['terminals', 'accessible'],
    queryFn: async () => {
      const response = await apiClient.get('/terminals/accessible');
      return response.data;
    },
    enabled: !!user,
  });

  // Load saved terminal from localStorage or select first available
  useEffect(() => {
    if (terminals.length > 0 && !selectedTerminal) {
      const savedTerminalId = localStorage.getItem('selectedTerminalId');
      if (savedTerminalId) {
        const savedTerminal = terminals.find(t => t.id === savedTerminalId);
        if (savedTerminal) {
          setSelectedTerminal(savedTerminal);
          return;
        }
      }
      // Default to first terminal
      setSelectedTerminal(terminals[0]);
    }
  }, [terminals, selectedTerminal]);

  // Save selected terminal to localStorage
  const handleSetSelectedTerminal = (terminal: Terminal | null) => {
    setSelectedTerminal(terminal);
    if (terminal) {
      localStorage.setItem('selectedTerminalId', terminal.id);
    } else {
      localStorage.removeItem('selectedTerminalId');
    }
  };

  return (
    <TerminalContext.Provider 
      value={{ 
        terminals, 
        selectedTerminal, 
        setSelectedTerminal: handleSetSelectedTerminal, 
        isLoading 
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
};