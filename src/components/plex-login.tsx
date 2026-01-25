'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { createPin, getPlexAuthUrl, checkPin } from '@/lib/plex-auth';
import { Loader2, ExternalLink } from 'lucide-react';

export function PlexLogin() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [pinId, setPinId] = useState<number | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pin = await createPin();
      setPinId(pin.id);
      const url = getPlexAuthUrl(pin.code);
      setAuthUrl(url);
      window.open(url, '_blank', 'width=800,height=600');
    } catch {
      setError('Failed to start authentication. Please try again.');
      setIsLoading(false);
    }
  };

  const pollForAuth = useCallback(async () => {
    if (!pinId) return;

    try {
      const pin = await checkPin(pinId);
      if (pin.authToken) {
        await login(pin.authToken);
        setPinId(null);
        setAuthUrl(null);
        setIsLoading(false);
      }
    } catch {
      // Continue polling
    }
  }, [pinId, login]);

  useEffect(() => {
    if (!pinId) return;

    const interval = setInterval(pollForAuth, 2000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPinId(null);
      setAuthUrl(null);
      setIsLoading(false);
      setError('Authentication timed out. Please try again.');
    }, 300000); // 5 minute timeout

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pinId, pollForAuth]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Plex Library Intersection</CardTitle>
        <CardDescription>
          Compare your Plex library with friends&apos; shared libraries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-500 text-center">{error}</div>
        )}

        {!authUrl ? (
          <Button 
            onClick={startAuth} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Sign in with Plex'
            )}
          </Button>
        ) : (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for authorization...</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A new window should have opened. Complete the sign-in there.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.open(authUrl, '_blank')}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Plex Login Again
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                setPinId(null);
                setAuthUrl(null);
                setIsLoading(false);
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
