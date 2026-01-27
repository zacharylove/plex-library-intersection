'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { PlexLogin } from '@/components/plex-login';
import { LibrarySelector } from '@/components/library-selector';
import { ComparisonLoader } from '@/components/comparison-loader';
import { AccountMenu } from '@/components/account-menu';
import type { PlexLibrary, PlexServer } from '@/lib/types';
import { Loader2, Sun, Moon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AppState =
  | { stage: 'login' }
  | { stage: 'select' }
  | {
      stage: 'compare';
      baseLibrary: PlexLibrary;
      compareLibraries: PlexLibrary[];
      servers: PlexServer[];
    };

const STORAGE_KEY = 'plex-comparison-state';

interface StoredState {
  baseLibrary: PlexLibrary;
  compareLibraries: PlexLibrary[];
  servers: PlexServer[];
}

function getInitialState(): AppState {
  // Always start fresh - don't restore from localStorage
  return { stage: 'login' };
}

export default function Home() {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [appState, setAppState] = useState<AppState>(getInitialState);

  // Save state to localStorage when in compare stage
  useEffect(() => {
    if (appState.stage === 'compare') {
      try {
        const toStore: StoredState = {
          baseLibrary: appState.baseLibrary,
          compareLibraries: appState.compareLibraries,
          servers: appState.servers,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      } catch (e) {
        console.error('Failed to save state to localStorage:', e);
      }
    }
  }, [appState]);

  const handleCompare = (
    baseLibrary: PlexLibrary,
    compareLibraries: PlexLibrary[],
    servers: PlexServer[]
  ) => {
    setAppState({ stage: 'compare', baseLibrary, compareLibraries, servers });
  };

  const handleBack = () => {
    setAppState({ stage: 'select' });
  };

  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full py-8 px-6">
        <header className="mb-8">
          <div className="flex justify-between items-center gap-2 mb-4">
            <div>
              {user && appState.stage === 'compare' && (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Selection
                </Button>
              )}
            </div>
            <div className="flex items-center">
              <AccountMenu />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          
        </header>

        {!user ? (
          <PlexLogin />
        ) : appState.stage === 'compare' ? (
          <ComparisonLoader
            baseLibrary={appState.baseLibrary}
            compareLibraries={appState.compareLibraries}
            servers={appState.servers}
            onBack={handleBack}
          />
        ) : (
          <LibrarySelector onCompare={handleCompare} />
        )}
      </div>
    </div>
  );
}
