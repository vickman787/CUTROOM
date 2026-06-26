"use client";

import { useEffect, useState } from "react";

// Resolves a playable URL for a reel. Returns:
//   - status "loading" while the source check is in flight
//   - status "real" with a usable URL (env override or Shelby-resolved)
//   - status "none" when nothing is wired and the surrogate should render
// Honors ?src= on the page URL as a first-class override for ad-hoc testing.

interface State {
  status: "loading" | "real" | "none";
  url?: string;
  fallbackUrl?: string;
  origin?: string;
}

export function useReelSource(slug: string, reelId: string, sourcePath?: string): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const queryUrl = params?.get("src");
    if (queryUrl) {
      setState({ status: "real", url: queryUrl, origin: "query" });
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const qs = sourcePath ? `?sourcePath=${encodeURIComponent(sourcePath)}` : "";
        const res = await fetch(`/api/projects/${slug}/reels/${reelId}/source${qs}`, { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 204) {
          setState({ status: "none" });
          return;
        }
        if (!res.ok) {
          setState({ status: "none" });
          return;
        }
        const data = (await res.json()) as { url?: string; fallbackUrl?: string; origin?: string };
        if (cancelled) return;
        if (data.url) setState({ status: "real", url: data.url, fallbackUrl: data.fallbackUrl, origin: data.origin });
        else setState({ status: "none" });
      } catch {
        if (!cancelled) setState({ status: "none" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, reelId, sourcePath]);

  return state;
}
