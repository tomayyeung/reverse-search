import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

import { API_URL } from "@/config";

export type CurrentUser = {
  username: string;
  displayName: string | null;
  official: boolean;
};

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
