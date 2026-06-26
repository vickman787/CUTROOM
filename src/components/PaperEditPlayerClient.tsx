"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/VideoPlayer";
import { useReelSource } from "@/lib/useReelSource";
import { formatTcShort } from "@/lib/time";
import type { Project, Reel, Select } from "@/domain/types";

interface Clip {
  select: Select;
  reel: Reel;
  label: string;
}

export function PaperEditPlayerClient({
  slug,
  fallbackProject,
}: {
  slug: string;
  fallbackProject: Project;
}) {
  const clips = useMemo<Clip[]>(() => {
    return fallbackProject.paperEdit
      .slice()
      .sort((a, b) => a.act - b.act || a.position - b.position)
      .flatMap((entry, index) => {
        const select = fallbackProject.selects.find((s) => s.id === entry.selectId);
        if (!select) return [];
        const reel = fallbackProject.reels.find((r) => r.id === select.reelId);
        if (!reel) return [];
        return [{ select, reel, label: `A${entry.act}.${index + 1}` }];
      });
  }, [fallbackProject]);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [pendingPlay, setPendingPlay] = useState(false);
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const clip = clips[index];
  const source = useReelSource(slug, clip?.reel.id ?? "", clip?.select.sourcePath);
  const src = fallbackUrl ?? (source.status === "real" ? source.url : undefined);

  useEffect(() => {
    setFallbackUrl(null);
    setPendingPlay(playing);
  }, [clip?.reel.id, clip?.select.sourcePath]);

  useEffect(() => {
    if (!clip) return;
    setCurrentMs(clip.select.inMs);
    setPendingPlay(playing);
  }, [clip, playing]);

  const advance = useCallback(() => {
    playerRef.current?.pause();
    if (index < clips.length - 1) {
      setPendingPlay(true);
      setIndex((i) => i + 1);
      return;
    }
    setPendingPlay(false);
    setPlaying(false);
  }, [clips.length, index]);

  if (!clip) {
    return (
      <main className="mx-auto max-w-[900px] px-8 py-10">
        <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">Paper edit player</p>
        <h1 className="mt-1 font-serif text-[36px] leading-none">No clips in the paper edit</h1>
        <Link href={`/projects/${slug}/paper-edit`} className="mt-6 inline-block border border-ink px-3 py-1 font-grotesk text-[10px] uppercase tracking-wider">
          Back to paper edit
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">Paper edit player</p>
          <h1 className="mt-1 font-serif text-[36px] leading-none">Sequence preview</h1>
        </div>
        <Link href={`/projects/${slug}/paper-edit`} className="border border-ink bg-paper px-3 py-1 font-grotesk text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper">
          Back to paper edit
        </Link>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-ink bg-black">
          <div className="aspect-video">
            <VideoPlayer
              key={`${clip.select.id}:${src ?? "none"}`}
              ref={playerRef}
              src={src}
              reel={clip.reel}
              currentMs={currentMs}
              durationMs={clip.reel.durationMs}
              playing={playing}
              rate={1}
              volume={0.9}
              muted={false}
              reduceMotion={false}
              onTimeUpdate={(ms) => {
                if (playing && ms >= clip.select.outMs) {
                  playerRef.current?.seek(clip.select.outMs);
                  advance();
                  return;
                }
                setCurrentMs(ms);
              }}
              onEnded={advance}
              onLoadedMetadata={() => {
                playerRef.current?.seek(clip.select.inMs);
                setCurrentMs(clip.select.inMs);
                if (pendingPlay || playing) {
                  playerRef.current?.play();
                  setPlaying(true);
                  setPendingPlay(false);
                }
              }}
              onError={() => {
                if (!fallbackUrl && source.status === "real" && source.fallbackUrl) {
                  setFallbackUrl(source.fallbackUrl);
                }
              }}
            />
          </div>
        </div>

        <aside className="border border-ink/40 bg-paper-warm p-4">
          <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
            Clip {index + 1} of {clips.length}
          </div>
          <h2 className="mt-1 font-serif text-[22px] leading-tight">{clip.label} · {clip.reel.label}</h2>
          <p className="mt-2 font-serif text-[14px] italic leading-snug">"{clip.select.quote}"</p>
          <div className="mt-4 font-grotesk text-[11px] uppercase tracking-wider text-ink/70">
            {formatTcShort(clip.select.inMs)} - {formatTcShort(clip.select.outMs)}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                playerRef.current?.seek(clip.select.inMs);
                setPlaying(true);
                setPendingPlay(true);
                playerRef.current?.play();
              }}
              className="border border-ink bg-ink px-3 py-1.5 font-grotesk text-[10px] uppercase tracking-wider text-paper hover:bg-vermilion hover:border-vermilion"
            >
              Play sequence
            </button>
            <button
              type="button"
              onClick={() => {
                playerRef.current?.pause();
                setPlaying(false);
              }}
              className="border border-ink bg-paper px-3 py-1.5 font-grotesk text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper"
            >
              Pause
            </button>
          </div>

          <ol className="mt-5 space-y-2">
            {clips.map((item, i) => (
              <li key={`${item.select.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    playerRef.current?.pause();
                    setPlaying(false);
                    setPendingPlay(false);
                    setIndex(i);
                    setCurrentMs(item.select.inMs);
                  }}
                  className={
                    "w-full border px-2 py-1 text-left font-grotesk text-[10px] uppercase tracking-wider " +
                    (i === index ? "border-vermilion bg-vermilion/10" : "border-ink/30 bg-paper")
                  }
                >
                  {i + 1}. {item.reel.label} · {formatTcShort(item.select.outMs - item.select.inMs)}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  );
}
