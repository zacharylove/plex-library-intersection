import type { PlexLibrary, PlexServer, PlexConnection, MediaItem } from './types';

const PLEX_TV_API = 'https://plex.tv/api/v2';
const CLIENT_ID = 'plex-library-intersection-web';

const commonHeaders = {
  'Accept': 'application/json',
  'X-Plex-Client-Identifier': CLIENT_ID,
};

export async function getServers(authToken: string): Promise<PlexServer[]> {
  const response = await fetch(`${PLEX_TV_API}/resources?includeHttps=1&includeRelay=1`, {
    headers: {
      ...commonHeaders,
      'X-Plex-Token': authToken,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch servers');
  }

  const data = await response.json();
  const servers: PlexServer[] = [];

  for (const resource of data) {
    if (resource.provides !== 'server') continue;

    const connections = resource.connections || [];
    const bestConnection = selectBestConnection(connections);

    if (bestConnection) {
      servers.push({
        name: resource.name,
        machineIdentifier: resource.clientIdentifier,
        accessToken: resource.accessToken,
        connection: bestConnection,
        owned: resource.owned,
      });
    }
  }

  return servers;
}

function selectBestConnection(connections: any[]): PlexConnection | undefined {
  const sorted = [...connections].sort((a, b) => {
    if (a.relay !== b.relay) return a.relay ? 1 : -1;
    if (a.local !== b.local) return a.local ? 1 : -1;
    return 0;
  });

  const conn = sorted[0];
  if (!conn) return undefined;

  return {
    uri: conn.uri,
    local: conn.local,
    relay: conn.relay,
  };
}

export async function getLibraries(server: PlexServer): Promise<PlexLibrary[]> {
  if (!server.connection || !server.accessToken) {
    return [];
  }

  try {
    const response = await fetch(`${server.connection.uri}/library/sections`, {
      headers: {
        'X-Plex-Token': server.accessToken,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const sections = data.MediaContainer?.Directory || [];

    return sections
      .filter((section: any) => ['movie', 'show'].includes(section.type))
      .map((section: any) => ({
        key: section.key,
        title: section.title,
        type: section.type as 'movie' | 'show',
        serverName: server.name,
        serverId: server.machineIdentifier,
        isLocal: server.owned,
      }));
  } catch (error) {
    console.error(`Failed to fetch libraries from ${server.name}:`, error);
    return [];
  }
}

export async function getLibraryItems(
  server: PlexServer,
  libraryKey: string,
  onProgress?: (processed: number, total: number) => void
): Promise<MediaItem[]> {
  if (!server.connection || !server.accessToken) {
    throw new Error('Server connection not available');
  }

  const response = await fetch(
    `${server.connection.uri}/library/sections/${libraryKey}/all`,
    {
      headers: {
        'X-Plex-Token': server.accessToken,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch library items: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawItems = data.MediaContainer?.Metadata || [];
  const total = rawItems.length;
  const results: MediaItem[] = [];
  
  // Process in chunks to allow UI updates
  const chunkSize = 50;
  for (let i = 0; i < rawItems.length; i += chunkSize) {
    const chunk = rawItems.slice(i, i + chunkSize);
    
    for (const item of chunk) {
      results.push(processMediaItem(item));
    }
    
    // Report progress and yield to UI
    if (onProgress) {
      onProgress(results.length, total);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return results;
}

function processMediaItem(item: any): MediaItem {
    // Extract IMDB/TMDB IDs from guids
    let imdbId: string | undefined;
    let tmdbId: string | undefined;
    
    const guids = item.Guid || [];
    for (const g of guids) {
      const id = g.id || '';
      if (id.startsWith('imdb://')) {
        imdbId = id.replace('imdb://', '');
      } else if (id.startsWith('tmdb://')) {
        tmdbId = id.replace('tmdb://', '');
      }
    }
    
    // Also check main guid
    if (item.guid) {
      if (item.guid.includes('imdb://')) {
        imdbId = imdbId || item.guid.match(/imdb:\/\/([^?]+)/)?.[1];
      } else if (item.guid.includes('themoviedb://')) {
        tmdbId = tmdbId || item.guid.match(/themoviedb:\/\/([^?]+)/)?.[1];
      }
    }

    // Extract media info
    const media = (item.Media || []).map((m: any) => {
      const part = m.Part?.[0];
      // Get video codec info (e.g., "HEVC Main 10", "H.264")
      const videoCodec = m.videoCodec?.toUpperCase() || '';
      const videoProfile = m.videoProfile || '';
      const codec = videoProfile ? `${videoCodec} ${videoProfile}` : videoCodec || 'Unknown';
      
      return {
        filename: part?.file?.split('/').pop() || 'Unknown',
        resolution: m.videoResolution ? `${m.videoResolution}p` : (m.height ? `${m.height}p` : 'Unknown'),
        format: codec,
        container: m.container?.toUpperCase() || 'Unknown',
        bitrate: m.bitrate,
      };
    });

  return {
    title: item.title,
    year: item.year || null,
    type: item.type as 'movie' | 'show',
    ratingKey: item.ratingKey,
    guid: item.guid,
    duration: item.duration,
    rating: item.rating,
    audienceRating: item.audienceRating,
    imdbId,
    tmdbId,
    media: media.length > 0 ? media : undefined,
  };
}

export async function getAllLibraries(authToken: string): Promise<{
  servers: PlexServer[];
  libraries: PlexLibrary[];
}> {
  const servers = await getServers(authToken);
  const allLibraries: PlexLibrary[] = [];

  for (const server of servers) {
    const libs = await getLibraries(server);
    allLibraries.push(...libs);
  }

  return { servers, libraries: allLibraries };
}
