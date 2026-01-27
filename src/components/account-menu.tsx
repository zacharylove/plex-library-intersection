'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LogOut, ChevronDown } from 'lucide-react';

export function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!user) return null;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button 
        className="flex items-center gap-2 my-1.5 hover:bg-muted transition-colors outline-none cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {user.thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.thumb}
            alt={user.username}
            className="w-8 h-8 rounded-full"
          />
        )}
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium leading-tight">{user.username}</p>
          <p className="text-xs text-muted-foreground leading-tight">{user.email}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div 
          className="absolute top-full w-56 bg-popover border shadow-md z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="px-2 py-1.5 sm:hidden border-b">
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full flex items-center px-2 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-accent cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
