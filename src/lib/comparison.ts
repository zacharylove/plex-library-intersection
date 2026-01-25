import type { MediaItem, MediaItemWithSources, ComparisonResult, LibraryWithItems, VennData, LibrarySource } from './types';

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function createMediaKey(item: MediaItem): string {
  const normalizedTitle = normalizeTitle(item.title);
  return `${normalizedTitle}|${item.year || 'unknown'}|${item.type}`;
}

export function findRelativeComplement(
  baseLibrary: LibraryWithItems,
  comparedLibraries: LibraryWithItems[]
): ComparisonResult {
  const baseKeys = new Set(baseLibrary.items.map(createMediaKey));

  const itemsNotInBase = new Map<string, MediaItemWithSources>();

  for (const { library, items } of comparedLibraries) {
    const libraryLabel = `${library.serverName} - ${library.title}`;
    const source: LibrarySource = {
      serverName: library.serverName,
      libraryName: library.title,
    };

    for (const item of items) {
      const key = createMediaKey(item);

      if (baseKeys.has(key)) {
        continue;
      }

      if (itemsNotInBase.has(key)) {
        const existing = itemsNotInBase.get(key)!;
        if (!existing.libraries.includes(libraryLabel)) {
          existing.libraries.push(libraryLabel);
          existing.sources.push({
            ...source,
            media: item.media,
          });
        }
      } else {
        itemsNotInBase.set(key, {
          ...item,
          libraries: [libraryLabel],
          sources: [{
            ...source,
            media: item.media,
          }],
        });
      }
    }
  }

  const sortedItems = Array.from(itemsNotInBase.values()).sort((a, b) => {
    const titleCompare = a.title.localeCompare(b.title);
    if (titleCompare !== 0) return titleCompare;
    return (a.year || 0) - (b.year || 0);
  });

  return {
    items: sortedItems,
    baseLibrary: baseLibrary.library,
    comparedLibraries: comparedLibraries.map(l => l.library),
  };
}

export function calculateVennData(
  baseLibrary: LibraryWithItems,
  comparedLibraries: LibraryWithItems[],
  colorMap?: Map<string, string>
): VennData {
  const fallbackColors = [
    'hsl(221, 83%, 53%)',  // Blue (base)
    'hsl(142, 76%, 36%)',  // Green
    'hsl(0, 84%, 60%)',    // Red
    'hsl(45, 93%, 47%)',   // Yellow
    'hsl(280, 87%, 65%)',  // Purple
  ];

  const allLibraries = [baseLibrary, ...comparedLibraries];
  const libraryKeys = allLibraries.map(l => 
    new Set(l.items.map(createMediaKey))
  );

  const libraries = allLibraries.map((l, i) => {
    const libKey = `${l.library.serverName} - ${l.library.title}`;
    return {
      name: libKey,
      totalItems: l.items.length,
      color: colorMap?.get(libKey) || fallbackColors[i % fallbackColors.length],
    };
  });

  const intersections: { sets: string[]; size: number }[] = [];

  // Calculate pairwise intersections
  for (let i = 0; i < allLibraries.length; i++) {
    for (let j = i + 1; j < allLibraries.length; j++) {
      const intersection = new Set(
        [...libraryKeys[i]].filter(key => libraryKeys[j].has(key))
      );
      if (intersection.size > 0) {
        intersections.push({
          sets: [libraries[i].name, libraries[j].name],
          size: intersection.size,
        });
      }
    }
  }

  // Calculate triple intersections if we have 3+ libraries
  if (allLibraries.length >= 3) {
    for (let i = 0; i < allLibraries.length; i++) {
      for (let j = i + 1; j < allLibraries.length; j++) {
        for (let k = j + 1; k < allLibraries.length; k++) {
          const intersection = new Set(
            [...libraryKeys[i]].filter(
              key => libraryKeys[j].has(key) && libraryKeys[k].has(key)
            )
          );
          if (intersection.size > 0) {
            intersections.push({
              sets: [libraries[i].name, libraries[j].name, libraries[k].name],
              size: intersection.size,
            });
          }
        }
      }
    }
  }

  return { libraries, intersections };
}

export interface LibrarySimilarity {
  library1: string;
  library2: string;
  similarity: number; // percentage 0-100
  sharedItems: number;
  totalUnique: number;
}

export function calculateSimilarities(
  baseLibrary: LibraryWithItems,
  comparedLibraries: LibraryWithItems[]
): LibrarySimilarity[] {
  const allLibraries = [baseLibrary, ...comparedLibraries];
  const libraryKeys = allLibraries.map(l => ({
    name: `${l.library.serverName} - ${l.library.title}`,
    keys: new Set(l.items.map(createMediaKey)),
  }));

  const similarities: LibrarySimilarity[] = [];

  for (let i = 0; i < libraryKeys.length; i++) {
    for (let j = i + 1; j < libraryKeys.length; j++) {
      const lib1 = libraryKeys[i];
      const lib2 = libraryKeys[j];
      
      const sharedItems = [...lib1.keys].filter(k => lib2.keys.has(k)).length;
      const totalUnique = new Set([...lib1.keys, ...lib2.keys]).size;
      const similarity = totalUnique > 0 ? (sharedItems / totalUnique) * 100 : 0;

      similarities.push({
        library1: lib1.name,
        library2: lib2.name,
        similarity: Math.round(similarity * 10) / 10,
        sharedItems,
        totalUnique,
      });
    }
  }

  return similarities.sort((a, b) => b.similarity - a.similarity);
}

export function getStatistics(result: ComparisonResult) {
  const movies = result.items.filter(i => i.type === 'movie');
  const shows = result.items.filter(i => i.type === 'show');

  const libraryCount = new Map<string, number>();
  for (const item of result.items) {
    for (const lib of item.libraries) {
      libraryCount.set(lib, (libraryCount.get(lib) || 0) + 1);
    }
  }

  return {
    totalItems: result.items.length,
    movieCount: movies.length,
    showCount: shows.length,
    itemsPerLibrary: Object.fromEntries(libraryCount),
  };
}

export function exportToCSV(items: MediaItemWithSources[]): string {
  const headers = ['Title', 'Year', 'Type', 'Libraries'];
  const rows: string[] = [headers.join(',')];

  for (const item of items) {
    const row = [
      escapeCSVField(item.title),
      item.year?.toString() || 'Unknown',
      item.type,
      escapeCSVField(item.libraries.join('; ')),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
