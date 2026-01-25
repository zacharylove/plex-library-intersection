import type { PlexPin, PlexUser } from './types';

const PLEX_TV_API = 'https://plex.tv/api/v2';
const CLIENT_ID = 'plex-library-intersection-web';
const PRODUCT_NAME = 'Plex Library Intersection';

const commonHeaders = {
  'Accept': 'application/json',
  'X-Plex-Client-Identifier': CLIENT_ID,
  'X-Plex-Product': PRODUCT_NAME,
  'X-Plex-Version': '1.0.0',
  'X-Plex-Platform': 'Web',
};

export async function createPin(): Promise<PlexPin> {
  const response = await fetch(`${PLEX_TV_API}/pins`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'strong=true',
  });

  if (!response.ok) {
    throw new Error('Failed to create Plex PIN');
  }

  const data = await response.json();
  return {
    id: data.id,
    code: data.code,
    authToken: data.authToken,
  };
}

export function getPlexAuthUrl(pinCode: string): string {
  const params = new URLSearchParams({
    clientID: CLIENT_ID,
    code: pinCode,
    'context[device][product]': PRODUCT_NAME,
  });
  return `https://app.plex.tv/auth#?${params.toString()}`;
}

export async function checkPin(pinId: number): Promise<PlexPin> {
  const response = await fetch(`${PLEX_TV_API}/pins/${pinId}`, {
    headers: commonHeaders,
  });

  if (!response.ok) {
    throw new Error('Failed to check PIN status');
  }

  const data = await response.json();
  return {
    id: data.id,
    code: data.code,
    authToken: data.authToken,
  };
}

export async function getPlexUser(authToken: string): Promise<PlexUser> {
  const response = await fetch(`${PLEX_TV_API}/user`, {
    headers: {
      ...commonHeaders,
      'X-Plex-Token': authToken,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json();
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    thumb: data.thumb,
    authToken,
  };
}
