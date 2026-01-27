'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/lib/theme-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VennDiagram } from './venn-diagram';
import type { ComparisonResult, VennData, LibraryWithItems, LibrarySource } from '@/lib/types';
import { getStatistics, exportToCSV, calculateVennData, calculateSimilarities, LibrarySimilarity } from '@/lib/comparison';
import { Download, Film, Tv, Search, Filter, ChevronDown, ChevronUp, ArrowUpDown, Copy, Settings2 } from 'lucide-react';
import { createMediaKey } from '@/lib/comparison';

// Check if a color is light (returns true) or dark (returns false)
function isLightColor(hslColor: string): boolean {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return false;
  const l = parseInt(match[3], 10);
  // Colors with lightness > 55% are considered light
  return l > 55;
}

// Parse HSL color string to components
function parseHSL(hslColor: string): { h: number; s: number; l: number } | null {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return null;
  return { h: parseInt(match[1], 10), s: parseInt(match[2], 10), l: parseInt(match[3], 10) };
}

// Average two HSL colors
function averageColors(color1: string, color2: string): string {
  const c1 = parseHSL(color1);
  const c2 = parseHSL(color2);
  if (!c1 || !c2) return color1;
  
  // Average hue with wrap-around handling
  let hDiff = c2.h - c1.h;
  if (hDiff > 180) hDiff -= 360;
  if (hDiff < -180) hDiff += 360;
  let avgH = c1.h + hDiff / 2;
  if (avgH < 0) avgH += 360;
  if (avgH >= 360) avgH -= 360;
  
  const avgS = (c1.s + c2.s) / 2;
  const avgL = (c1.l + c2.l) / 2;
  
  return `hsl(${Math.round(avgH)}, ${Math.round(avgS)}%, ${Math.round(avgL)}%)`;
}

// Gray color for user's library
function getBaseLibraryColor(isDark: boolean): string {
  return isDark ? 'hsl(0, 0%, 60%)' : 'hsl(0, 0%, 45%)';
}

// Color generation for libraries
function generateLibraryColors(libraries: string[], isDark: boolean): Map<string, string> {
  const colors = new Map<string, string>();
  
  // HSL ranges for good contrast
  // Dark mode: lighter colors (L: 55-75%), higher saturation
  // Light mode: darker colors (L: 35-50%), medium saturation
  const lightness = isDark ? { min: 55, max: 75 } : { min: 35, max: 50 };
  const saturation = isDark ? { min: 60, max: 80 } : { min: 50, max: 70 };
  
  // Minimum hue difference between colors (360 / max libraries)
  const minHueDiff = 360 / Math.max(libraries.length, 1);
  const usedHues: number[] = [];
  
  // Seed random based on library names for consistency
  const seed = libraries.join('').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const seededRandom = (i: number) => {
    const x = Math.sin(seed + i * 9999) * 10000;
    return x - Math.floor(x);
  };
  
  libraries.forEach((lib, i) => {
    // Find a hue that's far enough from existing ones
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

// Animated count component (600ms default = 25% faster than 800ms)
function AnimatedCount({ target, duration = 600, delay = 0 }: { target: number; duration?: number; delay?: number }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (target === 0) return;
    
    const delayTimeout = setTimeout(() => {
      const startTime = Date.now();
      let animationId: number;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(target * easeProgress));
        
        if (progress < 1) {
          animationId = requestAnimationFrame(animate);
        } else {
          setCount(target);
        }
      };
      
      animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    }, delay);
    
    return () => clearTimeout(delayTimeout);
  }, [target, duration, delay]);
  
  return <span className="font-mono-nums">{count.toLocaleString()}</span>;
}

// Animated progress bar component (525ms = 25% faster than 700ms)
function AnimatedProgress({ value, delay = 0, color }: { value: number; delay?: number; color?: string }) {
  const [width, setWidth] = useState(0);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      setWidth(value);
    }, delay + 75); // Small extra delay to ensure mount (reduced from 100)
    
    return () => clearTimeout(timeout);
  }, [value, delay]);
  
  return (
    <div 
      className="h-full transition-all duration-500 ease-out"
      style={{ width: `${width}%`, backgroundColor: color || 'var(--primary)' }}
    />
  );
}

// Format duration from milliseconds to human readable
function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Library badge with hover dropdown showing media info
function LibraryBadge({ source, color }: { source: LibrarySource; color?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };
  
  return (
    <div 
      className={`relative inline-block ${isOpen ? 'z-50' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span 
        className="inline-flex items-center px-2 py-0.5 text-xs cursor-default whitespace-nowrap border"
        style={color ? { 
          backgroundColor: color, 
          color: isLightColor(color) ? '#000' : '#fff',
          textShadow: isLightColor(color) ? 'none' : '0 1px 2px rgba(0,0,0,0.3)'
        } : undefined}
      >
        <span className="font-medium">{source.serverName}</span>
        <span className="mx-1 opacity-70">/</span>
        <span>{source.libraryName}</span>
      </span>
      
      {isOpen && source.media && source.media.length > 0 && (
        <div 
          className="absolute left-0 top-full mt-1 p-2 bg-popover border shadow-lg min-w-[250px] max-w-[350px] z-[9999]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-xs font-medium mb-1">Media Info</div>
          {source.media.map((m, i) => (
            <div key={i} className="text-xs text-muted-foreground space-y-0.5">
              <div>
                <span className="font-medium">File:</span>
                <div className="overflow-x-auto max-w-full bg-muted/50 rounded px-1 py-0.5 mt-0.5">
                  <code className="whitespace-nowrap select-all text-[10px]">{m.filename}</code>
                </div>
              </div>
              <div>
                <span className="font-medium">Resolution:</span> {m.resolution}
              </div>
              <div>
                <span className="font-medium">Codec:</span> {m.format}
              </div>
              {m.container && (
                <div>
                  <span className="font-medium">Container:</span> {m.container}
                </div>
              )}
              {m.bitrate && (
                <div>
                  <span className="font-medium">Bitrate:</span> {(m.bitrate / 1000).toFixed(1)} Mbps
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ComparisonResultsProps {
  result: ComparisonResult;
  baseLibraryWithItems: LibraryWithItems;
  comparedLibrariesWithItems: LibraryWithItems[];
}

export function ComparisonResults({
  result,
  baseLibraryWithItems,
  comparedLibrariesWithItems,
}: ComparisonResultsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'show'>('all');
  const [selectedLibraries, setSelectedLibraries] = useState<Set<string> | null>(null);
  const [selectedResolutions, setSelectedResolutions] = useState<Set<string> | null>(null);
  const [yearRange, setYearRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  
  // Pending filter state (applied on button click)
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingLibraries, setPendingLibraries] = useState<Set<string> | null>(null);
  const [pendingResolutions, setPendingResolutions] = useState<Set<string> | null>(null);
  const [pendingYearRange, setPendingYearRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [filtersApplied, setFiltersApplied] = useState(false);
  
  // Filter section collapse state
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  
  // Column visibility state
  const [columnsCollapsed, setColumnsCollapsed] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => 
    new Set(['title', 'year', 'runtime', 'availableIn'])
  );
  
  // All available columns with labels
  const allColumns = [
    { id: 'title', label: 'Title', default: true },
    { id: 'year', label: 'Year', default: true },
    { id: 'runtime', label: 'Runtime', default: true },
    { id: 'rating', label: 'Rating', default: false },
    { id: 'audienceRating', label: 'Audience Rating', default: false },
    { id: 'resolution', label: 'Resolution', default: false },
    { id: 'availableIn', label: 'Available In', default: true },
  ];
  
  const toggleColumn = (columnId: string) => {
    const newSet = new Set(visibleColumns);
    if (newSet.has(columnId)) {
      // Don't allow hiding title column
      if (columnId !== 'title') {
        newSet.delete(columnId);
      }
    } else {
      newSet.add(columnId);
    }
    setVisibleColumns(newSet);
  };
  
  const resetColumns = () => {
    setVisibleColumns(new Set(allColumns.filter(c => c.default).map(c => c.id)));
  };
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'title' | 'year' | 'runtime' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPage, setGoToPage] = useState('');
  const itemsPerPage = 50;
  const tableRef = React.useRef<HTMLDivElement>(null);

  const applyFilters = () => {
    setSearchQuery(pendingSearch);
    setSelectedLibraries(pendingLibraries ? new Set(pendingLibraries) : null);
    setSelectedResolutions(pendingResolutions ? new Set(pendingResolutions) : null);
    setYearRange({ ...pendingYearRange });
    setFiltersApplied(true);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setPendingSearch('');
    setPendingLibraries(null);
    setPendingResolutions(null);
    setPendingYearRange({ min: null, max: null });
    setSearchQuery('');
    setSelectedLibraries(null);
    setSelectedResolutions(null);
    setYearRange({ min: null, max: null });
    setFiltersApplied(false);
  };
  
  const toggleSort = (column: 'title' | 'year' | 'runtime') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  // Venn diagram library selection - auto-select first 2 libraries by default
  const [vennSelectedLibraries, setVennSelectedLibraries] = useState<Set<string>>(() => {
    const firstTwo = comparedLibrariesWithItems.slice(0, 2);
    return new Set(firstTwo.map(l => `${l.library.serverName} - ${l.library.title}`));
  });

  const stats = useMemo(() => getStatistics(result), [result]);
  
  // Get theme for color generation
  const { theme } = useTheme();
  
  // Generate colors for all libraries (including base as gray)
  const baseLibraryKey = `${baseLibraryWithItems.library.serverName} - ${baseLibraryWithItems.library.title}`;
  const libraryColors = useMemo(() => {
    const allLibraries = comparedLibrariesWithItems.map(l => 
      `${l.library.serverName} - ${l.library.title}`
    );
    const colors = generateLibraryColors(allLibraries, theme === 'dark');
    // Add base library as gray
    colors.set(baseLibraryKey, getBaseLibraryColor(theme === 'dark'));
    return colors;
  }, [comparedLibrariesWithItems, theme, baseLibraryKey]);
  
  // Filter compared libraries for Venn diagram based on selection
  const vennComparedLibraries = useMemo(() => {
    if (vennSelectedLibraries.size === 0) return [];
    return comparedLibrariesWithItems.filter(l => 
      vennSelectedLibraries.has(`${l.library.serverName} - ${l.library.title}`)
    );
  }, [comparedLibrariesWithItems, vennSelectedLibraries]);

  const vennData: VennData = useMemo(
    () => calculateVennData(baseLibraryWithItems, vennComparedLibraries, libraryColors),
    [baseLibraryWithItems, vennComparedLibraries, libraryColors]
  );

  // Calculate total unique across ALL libraries (including base)
  const totalUniqueAcrossAll = useMemo(() => {
    const allKeys = new Set<string>();
    // Add base library items
    baseLibraryWithItems.items.forEach(item => allKeys.add(createMediaKey(item)));
    // Add compared library items
    comparedLibrariesWithItems.forEach(lib => {
      lib.items.forEach(item => allKeys.add(createMediaKey(item)));
    });
    return allKeys.size;
  }, [baseLibraryWithItems, comparedLibrariesWithItems]);

  // Per-library stats with missing count
  const libraryStats = useMemo(() => {
    const baseKeys = new Set(baseLibraryWithItems.items.map(createMediaKey));
    return comparedLibrariesWithItems.map(lib => {
      const total = lib.items.length;
      const missing = lib.items.filter(item => !baseKeys.has(createMediaKey(item))).length;
      return {
        name: `${lib.library.serverName} - ${lib.library.title}`,
        total,
        missing,
      };
    });
  }, [baseLibraryWithItems, comparedLibrariesWithItems]);

  const similarities: LibrarySimilarity[] = useMemo(
    () => calculateSimilarities(baseLibraryWithItems, comparedLibrariesWithItems),
    [baseLibraryWithItems, comparedLibrariesWithItems]
  );

  // Filter similarities to only show selected libraries
  const filteredSimilarities = useMemo(() => {
    if (vennSelectedLibraries.size === 0) return [];
    const baseKey = `${baseLibraryWithItems.library.serverName} - ${baseLibraryWithItems.library.title}`;
    return similarities.filter(sim => {
      const lib1Selected = vennSelectedLibraries.has(sim.library1) || sim.library1 === baseKey;
      const lib2Selected = vennSelectedLibraries.has(sim.library2) || sim.library2 === baseKey;
      return lib1Selected && lib2Selected;
    });
  }, [similarities, vennSelectedLibraries, baseLibraryWithItems]);

  // Determine library type - all should be same type since we filter in selector
  const libraryType = result.baseLibrary.type;
  const isSingleType = libraryType === 'movie' || libraryType === 'show';

  // Get unique libraries and resolutions for filters
  const availableLibraries = useMemo(() => {
    const libs = new Set<string>();
    result.items.forEach(item => {
      item.sources.forEach(s => libs.add(`${s.serverName} / ${s.libraryName}`));
    });
    return Array.from(libs).sort();
  }, [result.items]);

  // Group libraries by server for nested display
  const librariesByServer = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    availableLibraries.forEach(lib => {
      const [server] = lib.split(' / ');
      if (!grouped[server]) grouped[server] = [];
      grouped[server].push(lib);
    });
    return grouped;
  }, [availableLibraries]);

  const availableResolutions = useMemo(() => {
    const res = new Set<string>();
    result.items.forEach(item => {
      item.sources.forEach(s => {
        s.media?.forEach(m => {
          if (m.resolution && m.resolution !== 'Unknown') res.add(m.resolution);
        });
      });
    });
    return Array.from(res).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numB - numA; // Higher resolution first
    });
  }, [result.items]);

  const yearBounds = useMemo(() => {
    const years = result.items.map(i => i.year).filter((y): y is number => y !== null);
    return {
      min: Math.min(...years, new Date().getFullYear()),
      max: Math.max(...years, 1900),
    };
  }, [result.items]);

  const filteredItems = useMemo(() => {
    let items = result.items;

    if (typeFilter !== 'all') {
      items = items.filter(item => item.type === typeFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        item =>
          item.title.toLowerCase().includes(query) ||
          item.year?.toString().includes(query)
      );
    }

    // Filter by selected libraries (null means all selected)
    if (selectedLibraries !== null && selectedLibraries.size > 0) {
      items = items.filter(item =>
        item.sources.some(s => selectedLibraries.has(`${s.serverName} / ${s.libraryName}`))
      );
    }

    // Filter by selected resolutions (null means all selected)
    if (selectedResolutions !== null && selectedResolutions.size > 0) {
      items = items.filter(item =>
        item.sources.some(s =>
          s.media?.some(m => selectedResolutions.has(m.resolution))
        )
      );
    }

    // Sort items
    if (sortColumn) {
      items = [...items].sort((a, b) => {
        let comparison = 0;
        if (sortColumn === 'title') {
          comparison = a.title.localeCompare(b.title);
        } else if (sortColumn === 'year') {
          comparison = (a.year || 0) - (b.year || 0);
        } else if (sortColumn === 'runtime') {
          comparison = (a.duration || 0) - (b.duration || 0);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    // Filter by year range
    if (yearRange.min !== null) {
      items = items.filter(item => item.year !== null && item.year >= yearRange.min!);
    }
    if (yearRange.max !== null) {
      items = items.filter(item => item.year !== null && item.year <= yearRange.max!);
    }

    return items;
  }, [result.items, typeFilter, searchQuery, selectedLibraries, selectedResolutions, yearRange, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);
  
  
  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const handleGoToPage = () => {
    const pageNum = parseInt(goToPage, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setGoToPage('');
      scrollToTable();
    }
  };

  const handleDownload = () => {
    const csv = exportToCSV(filteredItems);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plex_comparison_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="bg-muted/50 border-b">
            <CardTitle className="text-lg">Library Overlap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Library selector for Venn diagram */}
            <div>
              <label className="text-sm font-medium mb-2 block">Select libraries to compare:</label>
              <div className="flex flex-wrap gap-2">
                {comparedLibrariesWithItems.map((lib) => {
                  const libKey = `${lib.library.serverName} - ${lib.library.title}`;
                  const isSelected = vennSelectedLibraries.has(libKey);
                  const libColor = libraryColors.get(libKey);
                  const textColor = libColor && isLightColor(libColor) ? '#000' : '#fff';
                  // Use grey for unselected, library color for selected
                  const displayColor = isSelected ? libColor : (theme === 'dark' ? 'hsl(0, 0%, 45%)' : 'hsl(0, 0%, 70%)');
                  const displayTextColor = isSelected ? textColor : (theme === 'dark' ? '#fff' : '#333');
                  return (
                    <button
                      key={libKey}
                      onClick={() => {
                        const newSet = new Set(vennSelectedLibraries);
                        if (isSelected) {
                          newSet.delete(libKey);
                        } else if (newSet.size < 2) {
                          newSet.add(libKey);
                        }
                        setVennSelectedLibraries(newSet);
                      }}
                      className={`px-3 py-1.5 text-xs border transition-colors cursor-pointer rounded-full ${
                        !isSelected && vennSelectedLibraries.size >= 2 ? 'opacity-50 cursor-not-allowed' : ''
                      } ${vennSelectedLibraries.size < 2 ? 'hover:opacity-80' : ''}`}
                      style={{
                        backgroundColor: displayColor,
                        color: displayTextColor,
                        borderColor: displayColor,
                        textShadow: !isSelected ? 'none' : (libColor && isLightColor(libColor) ? 'none' : '0 1px 2px rgba(0,0,0,0.3)')
                      }}
                      disabled={!isSelected && vennSelectedLibraries.size >= 2}
                    >
                      {lib.library.serverName} / {lib.library.title}
                    </button>
                  );
                })}
              </div>
              {vennSelectedLibraries.size === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Select up to 2 libraries to visualize overlap with your library</p>
              )}
            </div>

            {vennSelectedLibraries.size > 0 && <VennDiagram data={vennData} />}
            
            {filteredSimilarities.length > 0 && (
              <div>
                <h4 className="font-medium text-sm bg-muted/50 border-b border-t px-3 py-2 -mx-6 mb-2">Library Similarity</h4>
                <div className="space-y-2">
                  {filteredSimilarities.map((sim, i) => {
                    // Determine bar color based on library pair
                    const isLib1Base = sim.library1 === baseLibraryKey;
                    const isLib2Base = sim.library2 === baseLibraryKey;
                    let barColor: string | undefined;
                    
                    if (isLib1Base || isLib2Base) {
                      // User library + external: use external library color
                      const externalLib = isLib1Base ? sim.library2 : sim.library1;
                      barColor = libraryColors.get(externalLib);
                    } else {
                      // Two external libraries: average their colors
                      const color1 = libraryColors.get(sim.library1);
                      const color2 = libraryColors.get(sim.library2);
                      if (color1 && color2) {
                        barColor = averageColors(color1, color2);
                      } else {
                        barColor = color1 || color2;
                      }
                    }
                    return (
                      <div key={i} className="text-sm py-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-muted-foreground truncate mr-2 text-xs">
                            {sim.library1.split(' - ')[0]} ↔ {sim.library2.split(' - ')[0]}
                          </span>
                          <span className="font-medium font-mono-nums shrink-0">{sim.similarity.toFixed(1).padStart(5, '\u00A0')}%</span>
                        </div>
                        <div className="h-2 bg-muted overflow-hidden">
                          <AnimatedProgress value={sim.similarity} delay={i * 75} color={barColor} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono-nums">{sim.sharedItems.toLocaleString()}</span> shared of <span className="font-mono-nums">{sim.totalUnique.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/50 border-b">
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-muted border">
                <div className="text-2xl font-bold"><AnimatedCount target={stats.totalItems} /></div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Missing</div>
              </div>
              <div className="p-3 bg-muted border">
                <div className="text-2xl font-bold"><AnimatedCount target={totalUniqueAcrossAll} /></div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Unique</div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm bg-muted/50 border-b border-t px-3 py-2 -mx-6 mb-3">Library Breakdown</h4>
              <div className="grid grid-cols-2 gap-2">
                {/* Base library card */}
                <div 
                  className="p-3 border"
                  style={{ borderLeftWidth: '4px', borderLeftColor: libraryColors.get(baseLibraryKey) }}
                >
                  <div className="text-xs text-muted-foreground truncate">{baseLibraryWithItems.library.serverName}</div>
                  <div className="font-medium text-sm truncate">{baseLibraryWithItems.library.title}</div>
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-mono-nums font-medium">{baseLibraryWithItems.items.length.toLocaleString()}</span>
                  </div>
                </div>
                
                {/* Compared library cards */}
                {libraryStats.map((lib) => {
                  const [serverName, libraryName] = lib.name.split(' - ');
                  const libColor = libraryColors.get(lib.name);
                  return (
                    <div 
                      key={lib.name}
                      className="p-3 border"
                      style={{ borderLeftWidth: '4px', borderLeftColor: libColor }}
                    >
                      <div className="text-xs text-muted-foreground truncate">{serverName}</div>
                      <div className="font-medium text-sm truncate">{libraryName}</div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-mono-nums font-medium">{lib.total.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Missing: </span>
                          <span className="font-mono-nums font-medium">{lib.missing.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-muted/50 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Missing Items</CardTitle>
            </div>
            <div className="flex gap-2 items-center">
              {!isSingleType && (
                <>
                  <Button
                    variant={typeFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTypeFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={typeFilter === 'movie' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTypeFilter('movie')}
                  >
                    <Film className="h-4 w-4 mr-1" />
                    Movies
                  </Button>
                  <Button
                    variant={typeFilter === 'show' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTypeFilter('show')}
                  >
                    <Tv className="h-4 w-4 mr-1" />
                    Shows
                  </Button>
                </>
              )}
              <Button variant="ghost" className="border"onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-1" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className={`w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted border-t border-l border-r ${filtersCollapsed ? 'border-b' : ''}`}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {filtersApplied && <span className="text-xs text-muted-foreground">(active)</span>}
              </span>
              {filtersCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            
            <div className={`p-4 space-y-4 border-l border-r border-b ${filtersCollapsed ? 'hidden' : ''}`}>
            {/* Row 1: Search */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search titles..."
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  className="w-full pl-10 pr-4 h-10 border bg-background text-sm"
                />
              </div>
            </div>

            {/* Row 2: Library and Resolution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Library filter - nested by server */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Libraries</label>
                <div className="border bg-background text-sm flex-1 max-h-32 overflow-y-auto">
                  {Object.entries(librariesByServer).map(([server, libs]) => {
                    const selectedLibs = pendingLibraries || new Set(availableLibraries);
                    const allSelected = libs.every(lib => selectedLibs.has(lib));
                    
                    const toggleServer = () => {
                      const newSet = new Set(selectedLibs);
                      if (allSelected) {
                        libs.forEach(lib => newSet.delete(lib));
                      } else {
                        libs.forEach(lib => newSet.add(lib));
                      }
                      setPendingLibraries(newSet);
                    };
                    
                    const toggleLibrary = (lib: string) => {
                      const newSet = new Set(selectedLibs);
                      if (newSet.has(lib)) {
                        newSet.delete(lib);
                      } else {
                        newSet.add(lib);
                      }
                      setPendingLibraries(newSet);
                    };
                    
                    return (
                      <div key={server}>
                        <button
                          type="button"
                          onClick={toggleServer}
                          className="w-full text-left py-1 text-xs font-medium text-muted-foreground"
                        >
                          <span className="px-2">{server}</span>
                        </button>
                        {libs.map(lib => {
                          const libName = lib.split(' / ')[1];
                          const isSelected = selectedLibs.has(lib);
                          return (
                            <button
                              key={lib}
                              type="button"
                              onClick={() => toggleLibrary(lib)}
                              className={`w-full text-left py-0.5 text-xs transition-colors ${
                                isSelected ? 'bg-muted-foreground/20 dark:bg-muted-foreground/40' : 'hover:bg-muted'
                              }`}
                            >
                              <span className="pl-5 pr-2">{libName}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {!pendingLibraries || pendingLibraries.size === availableLibraries.length ? 'All libraries' : `${pendingLibraries.size} selected`}
                </div>
              </div>

              {/* Resolution filter - click to toggle */}
              <div className="flex flex-col">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Resolutions</label>
                <div className="border bg-background text-sm flex-1 max-h-32 overflow-y-auto">
                  {availableResolutions.map(res => {
                    const selectedRes = pendingResolutions || new Set(availableResolutions);
                    const isSelected = selectedRes.has(res);
                    
                    const toggleResolution = () => {
                      const newSet = new Set(selectedRes);
                      if (newSet.has(res)) {
                        newSet.delete(res);
                      } else {
                        newSet.add(res);
                      }
                      setPendingResolutions(newSet);
                    };
                    
                    return (
                      <button
                        key={res}
                        type="button"
                        onClick={toggleResolution}
                        className={`w-full text-left py-1 text-xs transition-colors ${
                          isSelected ? 'bg-muted-foreground/20 dark:bg-muted-foreground/40' : 'hover:bg-muted'
                        }`}
                      >
                        <span className="px-2">{res}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {!pendingResolutions || pendingResolutions.size === availableResolutions.length ? 'All resolutions' : `${pendingResolutions.size} selected`}
                </div>
              </div>
            </div>

            {/* Row 3: Year range and Apply button */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Year Range</label>
                <div className="flex gap-2 items-end">
                  <input
                    type="number"
                    placeholder={`Min (${yearBounds.min})`}
                    value={pendingYearRange.min ?? ''}
                    onChange={(e) => setPendingYearRange(prev => ({ ...prev, min: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full h-8 px-3 border bg-background text-sm"
                    min={yearBounds.min}
                    max={yearBounds.max}
                  />
                  <span className="text-muted-foreground h-8">-</span>
                  <input
                    type="number"
                    placeholder={`Max (${yearBounds.max})`}
                    value={pendingYearRange.max ?? ''}
                    onChange={(e) => setPendingYearRange(prev => ({ ...prev, max: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full h-8 px-3 border bg-background text-sm"
                    min={yearBounds.min}
                    max={yearBounds.max}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={applyFilters} size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Apply Filters
                </Button>
                {filtersApplied && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            </div>
          </div>

          {/* Column Configuration - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => setColumnsCollapsed(!columnsCollapsed)}
              className={`w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted border-t border-l border-r ${filtersCollapsed ? 'border-b' : ''}`}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Columns
                {visibleColumns.size !== allColumns.filter(c => c.default).length && (
                  <span className="text-xs text-muted-foreground">(customized)</span>
                )}
              </span>
              {columnsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            
            <div className={`p-4 space-y-4 border-l border-r border-b ${columnsCollapsed ? 'hidden' : ''}`}>
              <div className="flex flex-wrap gap-2 mb-3">
                {allColumns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    disabled={col.id === 'title'}
                    className={`px-3 py-1.5 text-xs border transition-colors ${
                      visibleColumns.has(col.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'
                    } ${col.id === 'title' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="border" onClick={resetColumns}>
                  Reset to Default
                </Button>
              </div>
            </div>
          </div>

          <div ref={tableRef} className="max-h-[500px] -mx-6 overflow-y-auto border-t">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted border-b" style={{ zIndex: 10 }}>
                <tr>
                  {visibleColumns.has('title') && (
                    <th 
                      className="text-left py-1.5 px-2 font-medium cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => toggleSort('title')}
                    >
                      <span className="flex items-center gap-1">
                        Title
                        <ArrowUpDown className={`h-3 w-3 ${sortColumn === 'title' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </span>
                    </th>
                  )}
                  {visibleColumns.has('year') && (
                    <th 
                      className="text-left py-1.5 px-2 font-medium w-20 cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => toggleSort('year')}
                    >
                      <span className="flex items-center gap-1">
                        Year
                        <ArrowUpDown className={`h-3 w-3 ${sortColumn === 'year' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </span>
                    </th>
                  )}
                  {visibleColumns.has('runtime') && (
                    <th 
                      className="text-left py-1.5 px-2 font-medium w-24 cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => toggleSort('runtime')}
                    >
                      <span className="flex items-center gap-1">
                        Runtime
                        <ArrowUpDown className={`h-3 w-3 ${sortColumn === 'runtime' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </span>
                    </th>
                  )}
                  {visibleColumns.has('rating') && (
                    <th className="text-left py-1.5 px-2 font-medium w-20">Rating</th>
                  )}
                  {visibleColumns.has('audienceRating') && (
                    <th className="text-left py-1.5 px-2 font-medium w-20">Audience</th>
                  )}
                  {visibleColumns.has('resolution') && (
                    <th className="text-left py-1.5 px-2 font-medium w-24">Resolution</th>
                  )}
                  {visibleColumns.has('availableIn') && (
                    <th className="text-left py-1.5 px-2 font-medium">Available In</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, i) => (
                  <tr key={i} className={`border-b last:border-0 hover:bg-muted/30 group ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    {visibleColumns.has('title') && (
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-2">
                          {item.type === 'movie' ? (
                            <Film className="h-3 w-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <Tv className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          <span>{item.title}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(item.title)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-opacity"
                            title="Copy title"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.has('year') && (
                      <td className="py-1 px-2 text-muted-foreground font-mono-nums">
                        {item.year || '—'.padStart(4, '\u00A0')}
                      </td>
                    )}
                    {visibleColumns.has('runtime') && (
                      <td className="py-1 px-2 text-muted-foreground font-mono-nums">
                        {item.duration ? formatDuration(item.duration).padStart(6, '\u00A0') : '—'.padStart(6, '\u00A0')}
                      </td>
                    )}
                    {visibleColumns.has('rating') && (
                      <td className="py-1 px-2 text-muted-foreground font-mono-nums">
                        {item.rating ? item.rating.toFixed(1) : '—'}
                      </td>
                    )}
                    {visibleColumns.has('audienceRating') && (
                      <td className="py-1 px-2 text-muted-foreground font-mono-nums">
                        {item.audienceRating ? item.audienceRating.toFixed(1) : '—'}
                      </td>
                    )}
                    {visibleColumns.has('resolution') && (
                      <td className="py-1 px-2 text-muted-foreground text-xs">
                        {item.sources[0]?.media?.[0]?.resolution || '—'}
                      </td>
                    )}
                    {visibleColumns.has('availableIn') && (
                      <td className="py-1 px-2 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {item.sources.map((source, j) => (
                            <LibraryBadge 
                              key={j} 
                              source={source} 
                              color={libraryColors.get(`${source.serverName} - ${source.libraryName}`)}
                            />
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-4 -mx-6 -mb-6 p-3 border-t bg-background">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground font-mono-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground font-mono-nums">
                  {filteredItems.length.toLocaleString()} items
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCurrentPage(1); scrollToTable(); }}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCurrentPage(p => p - 1); scrollToTable(); }}
                  disabled={currentPage === 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCurrentPage(p => p + 1); scrollToTable(); }}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCurrentPage(totalPages); scrollToTable(); }}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Go to:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={goToPage}
                  onChange={(e) => setGoToPage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGoToPage()}
                  className="w-16 px-2 py-1 text-sm border bg-background"
                  placeholder="#"
                />
                <Button variant="outline" size="sm" onClick={handleGoToPage}>
                  Go
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToTable}
                >
                  ↑ Top
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
