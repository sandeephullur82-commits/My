import React, { createContext, useContext, useState, useEffect } from 'react';

interface UIContextType {
  isCompact: boolean;
  setCompact: (compact: boolean) => void;
  toggleCompact: () => void;
  // Global Entry State
  entryTab: string;
  setEntryTab: (tab: string) => void;
  paymentFilter: string;
  setPaymentFilter: (filter: string) => void;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  resetEntryFilters: () => void;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  isCustomerDetailsOpen: boolean;
  setIsCustomerDetailsOpen: (isOpen: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    const saved = localStorage.getItem('pigmy_ui_compact');
    return saved === 'true';
  });

  const [entryTab, setEntryTab] = useState<string>('PENDING');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = useState<boolean>(false);

  const setCompact = (compact: boolean) => {
    setIsCompact(compact);
    localStorage.setItem('pigmy_ui_compact', compact.toString());
  };

  const toggleCompact = () => {
    setCompact(!isCompact);
  };

  const resetEntryFilters = () => {
    setEntryTab('PENDING');
    setPaymentFilter('ALL');
    setDateFilter('ALL');
    setSearchTerm('');
  };

  return (
    <UIContext.Provider value={{ 
      isCompact, 
      setCompact, 
      toggleCompact,
      entryTab,
      setEntryTab,
      paymentFilter,
      setPaymentFilter,
      dateFilter,
      setDateFilter,
      searchTerm,
      setSearchTerm,
      resetEntryFilters,
      isModalOpen,
      setIsModalOpen,
      isCustomerDetailsOpen,
      setIsCustomerDetailsOpen
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
