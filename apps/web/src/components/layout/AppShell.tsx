import React from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { useAuth } from '../../hooks/useAuth';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNav />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
