'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getLibraryItems } from '@/lib/plex-api';
import { findRelativeComplement } from '@/lib/comparison';
import { ComparisonResults } from './comparison-results';
import type { PlexLibrary, PlexServer, ComparisonResult, LibraryWithItems } from '@/lib/types';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from './ui/button';

// Color generation for libraries (same as in comparison-results)
function generateLibraryColors(libraries: string[], isDark: boolean): Map<string, string> {
  const colors = new Map<string, string>();
  const lightness = isDark ? { min: 55, max: 75 } : { min: 35, max: 50 };
  const saturation = isDark ? { min: 60, max: 80 } : { min: 50, max: 70 };
  const minHueDiff = 360 / Math.max(libraries.length, 1);
  const usedHues: number[] = [];
  const seed = libraries.join('').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const seededRandom = (i: number) => {
    const x = Math.sin(seed + i * 9999) * 10000;
    return x - Math.floor(x);
  };
  libraries.forEach((lib, i) => {
    let hue: number;
    let attempts = 0;
    do {
      hue = Math.floor(seededRandom(i + attempts * 100) * 360);
      attempts++;
    } while (
      attempts < 50 && 
      usedHues.some(h => Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)) < minHueDiff * 0.7)
    );
    usedHues.push(hue);
    const s = saturation.min + seededRandom(i + 1000) * (saturation.max - saturation.min);
    const l = lightness.min + seededRandom(i + 2000) * (lightness.max - lightness.min);
    colors.set(lib, `hsl(${hue}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`);
  });
  return colors;
}

interface ComparisonLoaderProps {
  baseLibrary: PlexLibrary;
  compareLibraries: PlexLibrary[];
  servers: PlexServer[];
  onBack: () => void;
  onNewComparison?: () => void;
}

interface LoadingState {
  library: PlexLibrary;
  status: 'pending' | 'loading' | 'done' | 'error';
  itemCount?: number;
  error?: string;
}

export function ComparisonLoader({
  baseLibrary,
  compareLibraries,
  servers,
  onBack,
  onNewComparison,
}: ComparisonLoaderProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loadingStates, setLoadingStates] = useState<LoadingState[]>([]);
  
  // Generate colors for compared libraries (excluding base library)
  const libraryColors = useMemo(() => {
    const libs = compareLibraries.map(l => `${l.serverName} - ${l.title}`);
    return generateLibraryColors(libs, theme === 'dark');
  }, [compareLibraries, theme]);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [baseLibraryWithItems, setBaseLibraryWithItems] = useState<LibraryWithItems | null>(null);
  const [comparedLibrariesWithItems, setComparedLibrariesWithItems] = useState<LibraryWithItems[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const allLibraries = [baseLibrary, ...compareLibraries];
    setLoadingStates(
      allLibraries.map(lib => ({ library: lib, status: 'pending' }))
    );

    const fetchAllLibraries = async () => {
      const libraryItems: LibraryWithItems[] = [];

      for (let i = 0; i < allLibraries.length; i++) {
        const library = allLibraries[i];
        const server = servers.find(s => s.machineIdentifier === library.serverId);

        if (!server) {
          setLoadingStates(prev =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: 'error', error: 'Server not found' } : s
            )
          );
          continue;
        }

        setLoadingStates(prev =>
          prev.map((s, idx) => (idx === i ? { ...s, status: 'loading' } : s))
        );

        try {
          const items = await getLibraryItems(server, library.key);
          libraryItems.push({ library, items });

          setLoadingStates(prev =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: 'done', itemCount: items.length } : s
            )
          );
        } catch (err) {
          setLoadingStates(prev =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, status: 'error', error: err instanceof Error ? err.message : 'Failed to load' }
                : s
            )
          );
        }
      }

      // Compute results
      const baseWithItems = libraryItems.find(
        l => l.library.serverId === baseLibrary.serverId && l.library.key === baseLibrary.key
      );
      const comparedWithItems = libraryItems.filter(
        l => !(l.library.serverId === baseLibrary.serverId && l.library.key === baseLibrary.key)
      );

      if (!baseWithItems) {
        setError('Failed to load your library');
        return;
      }

      if (comparedWithItems.length === 0) {
        setError('Failed to load any libraries to compare');
        return;
      }

      setBaseLibraryWithItems(baseWithItems);
      setComparedLibrariesWithItems(comparedWithItems);

      const comparisonResult = findRelativeComplement(baseWithItems, comparedWithItems);
      setResult(comparisonResult);
    };

    fetchAllLibraries();
  }, [user, baseLibrary, compareLibraries, servers]);

  if (result && baseLibraryWithItems && comparedLibrariesWithItems.length > 0) {
    return (
      <ComparisonResults
        result={result}
        baseLibraryWithItems={baseLibraryWithItems}
        comparedLibrariesWithItems={comparedLibrariesWithItems}
        onBack={onBack}
        onNewComparison={onNewComparison}
      />
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Loading Libraries</CardTitle>
        <CardDescription>
          Fetching items from each library to compare
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingStates.map((state, i) => {
          const libKey = `${state.library.serverName} - ${state.library.title}`;
          const isBaseLib = i === 0;
          // Base library uses grey, external libraries use their colors
          const baseGrey = theme === 'dark' ? 'hsl(0, 0%, 60%)' : 'hsl(0, 0%, 45%)';
          const libColor = isBaseLib ? baseGrey : libraryColors.get(libKey);
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {state.status === 'pending' && (
                  <div 
                    className="w-5 h-5 rounded-full border-2"
                    style={{ borderColor: libColor || 'var(--muted)' }}
                  />
                )}
                {state.status === 'loading' && (
                  <Loader2 
                    className="w-5 h-5 animate-spin"
                    style={{ color: libColor }}
                  />
                )}
                {state.status === 'done' && (
                  <CheckCircle 
                    className="w-5 h-5"
                    style={{ color: libColor }}
                  />
                )}
                {state.status === 'error' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">
                  {state.library.serverName} - {state.library.title}
                </div>
                <div className="h-5 relative">
                  {state.status === 'loading' && (
                    <div className="text-sm text-muted-foreground absolute inset-0 animate-in fade-in slide-in-from-bottom-1 duration-200 font-mono-nums">
                      Processing...
                    </div>
                  )}
                  {state.status === 'done' && (
                    <div 
                      className="text-sm absolute inset-0 animate-in fade-in slide-in-from-bottom-2 duration-200 font-mono-nums"
                      style={{ color: libColor || 'var(--muted-foreground)' }}
                    >
                      {(state.itemCount || 0).toLocaleString()} items
                    </div>
                  )}
                </div>
                {state.status === 'error' && (
                  <div className="text-sm text-red-500">{state.error}</div>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <div className="pt-4">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={onBack} className="w-full">
              Go Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
