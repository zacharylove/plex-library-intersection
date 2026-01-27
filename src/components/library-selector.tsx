'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { getAllLibraries } from '@/lib/plex-api';
import type { PlexLibrary, PlexServer } from '@/lib/types';
import { Loader2, Server, Film, Tv } from 'lucide-react';

interface LibrarySelectorProps {
  onCompare: (
    baseLibrary: PlexLibrary,
    compareLibraries: PlexLibrary[],
    servers: PlexServer[]
  ) => void;
}

export function LibrarySelector({ onCompare }: LibrarySelectorProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [baseLibrary, setBaseLibrary] = useState<PlexLibrary | null>(null);
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const load = async () => {
      try {
        const { servers, libraries } = await getAllLibraries(user.authToken);
        if (!cancelled) {
          setServers(servers);
          setLibraries(libraries);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load libraries: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const ownedLibraries = libraries.filter(l => l.isLocal);
  const sharedLibraries = libraries.filter(l => !l.isLocal);

  const compatibleSharedLibraries = baseLibrary
    ? sharedLibraries.filter(l => l.type === baseLibrary.type)
    : [];

  const handleBaseSelect = (library: PlexLibrary) => {
    setBaseLibrary(library);
    setSelectedLibraries(new Set());
  };

  const toggleLibrary = (libraryId: string) => {
    const newSelected = new Set(selectedLibraries);
    if (newSelected.has(libraryId)) {
      newSelected.delete(libraryId);
    } else {
      newSelected.add(libraryId);
    }
    setSelectedLibraries(newSelected);
  };

  const selectAll = () => {
    setSelectedLibraries(new Set(compatibleSharedLibraries.map(l => `${l.serverId}-${l.key}`)));
  };

  const handleCompare = () => {
    if (!baseLibrary || selectedLibraries.size === 0) return;

    const compareLibs = compatibleSharedLibraries.filter(l =>
      selectedLibraries.has(`${l.serverId}-${l.key}`)
    );

    onCompare(baseLibrary, compareLibs, servers);
  };

  const getLibraryId = (lib: PlexLibrary) => `${lib.serverId}-${lib.key}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading libraries...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  const groupedByServer = sharedLibraries.reduce((acc, lib) => {
    if (!acc[lib.serverName]) acc[lib.serverName] = [];
    acc[lib.serverName].push(lib);
    return acc;
  }, {} as Record<string, PlexLibrary[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 1: Select Your Library</CardTitle>
          <CardDescription>
            Choose the library you want to compare against
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ownedLibraries.map((lib) => (
              <Button
                key={getLibraryId(lib)}
                variant={baseLibrary === lib ? 'default' : 'outline'}
                className={`justify-start h-auto py-3 cursor-pointer ${baseLibrary !== lib ? 'hover:bg-muted dark:hover:bg-muted/80' : ''}`}
                onClick={() => handleBaseSelect(lib)}
              >
                {lib.type === 'movie' ? (
                  <Film className="h-4 w-4 mr-2 shrink-0" />
                ) : (
                  <Tv className="h-4 w-4 mr-2 shrink-0" />
                )}
                <div className="text-left">
                  <div>{lib.title}</div>
                  <div className="text-xs opacity-70">{lib.serverName}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {baseLibrary && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Step 2: Select Libraries to Compare</CardTitle>
                <CardDescription>
                  Choose one or more {baseLibrary.type === 'movie' ? 'movie' : 'TV show'} libraries from friends
                </CardDescription>
              </div>
              {compatibleSharedLibraries.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {compatibleSharedLibraries.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No shared {baseLibrary.type === 'movie' ? 'movie' : 'TV show'} libraries available
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedByServer).map(([serverName, libs]) => {
                  const compatibleLibs = libs.filter(l => l.type === baseLibrary.type);
                  if (compatibleLibs.length === 0) return null;

                  return (
                    <div key={serverName}>
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                        <Server className="h-4 w-4" />
                        {serverName}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-6">
                        {compatibleLibs.map((lib) => {
                          const id = getLibraryId(lib);
                          const isSelected = selectedLibraries.has(id);
                          return (
                            <Button
                              key={id}
                              variant={isSelected ? 'default' : 'outline'}
                              className={`justify-start h-auto py-3 cursor-pointer ${!isSelected ? 'hover:bg-muted dark:hover:bg-muted/80' : ''}`}
                              onClick={() => toggleLibrary(id)}
                            >
                              {lib.type === 'movie' ? (
                                <Film className="h-4 w-4 mr-2 shrink-0" />
                              ) : (
                                <Tv className="h-4 w-4 mr-2 shrink-0" />
                              )}
                              <span className="text-left">{lib.title}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {baseLibrary && selectedLibraries.size > 0 && (
        <Button onClick={handleCompare} className="w-full" size="lg">
          Compare Libraries ({selectedLibraries.size} selected)
        </Button>
      )}
    </div>
  );
}
