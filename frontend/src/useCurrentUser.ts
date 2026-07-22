import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

import { API_URL } from "@/config";

/** Authenticated app user shape returned by `/api/me`. */
export type CurrentUser = {
  username: string;
  displayName: string | null;
  official: boolean;
};

/**
 * Loads the signed-in user's synced app profile from `/api/me`.
 *
 * Returns `undefined` while Clerk is loading, while signed out, and after load
 * failures; callers that need a separate loading/error state should fetch
 * directly.
 */
export function useCurrentUser() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchCurrentUser() {
      if (!isLoaded || !isSignedIn) {
        setCurrentUser(undefined);
        return;
      }

      try {
        const token = await getToken();
        if (cancelled) return;

        const headers: HeadersInit = {};

        if (token !== null) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/api/me`, {
          headers,
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load account profile");
        }

        if (!cancelled) {
          setCurrentUser(data as CurrentUser);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (!cancelled) {
          setCurrentUser(undefined);
        }
      }
    }

    void fetchCurrentUser();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [getToken, isLoaded, isSignedIn]);

  return currentUser;
}
