export interface PlexLibrary {
  key: string;
  title: string;
  type: 'movie' | 'show' | 'artist' | 'photo';
  serverName: string;
  serverId: string;
  isLocal: boolean;
}

export interface PlexServer {
  name: string;
  machineIdentifier: string;
  accessToken?: string;
  connection?: PlexConnection;
  owned: boolean;
}

export interface PlexConnection {
  uri: string;
  local: boolean;
  relay: boolean;
}

export interface MediaInfo {
  filename: string;
  resolution: string;
  format: string;
  container?: string;
  bitrate?: number;
}

export interface MediaItem {
  title: string;
  year: number | null;
  type: 'movie' | 'show';
  ratingKey: string;
  guid?: string;
  // Additional metadata
  duration?: number; // runtime in milliseconds
  rating?: number;
  audienceRating?: number;
  imdbId?: string;
  tmdbId?: string;
  media?: MediaInfo[];
}

export interface LibrarySource {
  serverName: string;
  libraryName: string;
  media?: MediaInfo[];
}

export interface MediaItemWithSources extends MediaItem {
  libraries: string[]; // kept for backwards compatibility
  sources: LibrarySource[]; // detailed source info
}

export interface ComparisonResult {
  items: MediaItemWithSources[];
  baseLibrary: PlexLibrary;
  comparedLibraries: PlexLibrary[];
}

export interface PlexPin {
  id: number;
  code: string;
  authToken: string | null;
}

export interface PlexUser {
  id: number;
  username: string;
  email: string;
  thumb: string;
  authToken: string;
}

export interface LibraryWithItems {
  library: PlexLibrary;
  items: MediaItem[];
}

export interface VennData {
  libraries: {
    name: string;
    totalItems: number;
    color: string;
  }[];
  intersections: {
    sets: string[];
    size: number;
  }[];
}
