"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/VideoPlayer";
import { DropZone } from "@/components/DropZone";
import { useReelSource } from "@/lib/useReelSource";
import { replaceReelTranscript, replaceReelVideo, saveSelect, useProject } from "@/lib/project-store";
import { formatTc, formatTcShort } from "@/lib/time";
import type {
  Project,
  Quotation,
  Reel,
  Theme,
  TranscriptSegment,
} from "@/domain/types";

interface Props {
  slug: string;
  reelId: string;
  fallbackProject: Project;
}

type Highlight =
  | { kind: "none" }
  | { kind: "segment"; segmentIds: string[] }
  | { kind: "select"; inMs: number; outMs: number };

export function ScreeningRoom({ slug, reelId, fallbackProject }: Props) {
  const searchParams = useSearchParams();
  const live = useProject(slug);
  const project = live ?? fallbackProject;
  const reel = project.reels.find((r) => r.id === reelId) ?? project.reels[0];
  const selectedSelectId = searchParams.get("select");
  const selectedSelect = selectedSelectId ? project.selects.find((s) => s.id === selectedSelectId) : undefined;

  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<Highlight>({ kind: "none" });
  const [showFlash, setShowFlash] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const source = useReelSource(slug, reel.id, selectedSelect?.sourcePath);
  const [localSource, setLocalSource] = useState<{ url: string; origin: string } | null>(null);
  const [sourceFallbackUrl, setSourceFallbackUrl] = useState<string | null>(null);
  const effectiveSrc = localSource?.url ?? sourceFallbackUrl ?? (source.status === "real" ? source.url : undefined);
  const hasRealVideo = !!effectiveSrc;
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "done";
    fileName?: string;
    sizeBytes?: number;
    error?: string;
  }>({ status: "idle" });
  const appliedSelectRef = useRef<string | null>(null);
  const savedSelectRange = useMemo(() => {
    const selectId = searchParams.get("select");
    const inMs = Number(searchParams.get("in"));
    const outMs = Number(searchParams.get("out"));
    if (!selectId || !Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return null;
    return {
      inMs: Math.max(0, Math.min(reel.durationMs, inMs)),
      outMs: Math.max(0, Math.min(reel.durationMs, outMs)),
    };
  }, [searchParams, reel.durationMs]);

  const [pipeline, setPipeline] = useState<{
    step: "idle" | "transcribing" | "analyzing";
    error?: string;
  }>({ step: "idle" });

  const openFilePicker = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleLocalFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const ok = file.type.startsWith("video/") || /^(mp4|webm|mov|mkv|avi|mxf)$/i.test(ext);
      if (!ok) {
        setUploadStatus({ status: "idle", error: `Unsupported format .${ext}. Accepted: mp4, webm, mov, mkv, avi, mxf` });
        return;
      }
      const blobUrl = URL.createObjectURL(file);
      setLocalSource({ url: blobUrl, origin: `local (${file.name})` });
      setUploadStatus({ status: "uploading", fileName: file.name, sizeBytes: file.size });

      (async () => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("reelId", reel.id);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          if (!res.ok) throw new Error(await res.text());
          const uploaded = (await res.json()) as { url?: string; path?: string; blobPath?: string };
          const storedPath = uploaded.path ?? uploaded.blobPath ?? uploaded.url;
          if (storedPath) replaceReelVideo(slug, reel.id, storedPath);
          setUploadStatus((prev) => ({ ...prev, status: "done" }));
          // Refresh the project to pick up the reel's new videoPath.
          const projRes = await fetch(`/api/projects/${slug}/reels/${reel.id}/source`);
          if (projRes.ok && projRes.status !== 204) {
            const srcData = (await projRes.json()) as { url?: string };
            if (srcData.url) {
              setLocalSource({ url: srcData.url, origin: "uploaded" });
            }
          }
        } catch (e: unknown) {
          setUploadStatus((prev) => ({
            ...prev,
            status: "idle",
            error: `Upload failed: ${(e as Error).message}`,
          }));
        }
      })();
    },
    [reel.id, slug],
  );

  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const transcriptColRef = useRef<HTMLDivElement>(null);

  // Playhead source of truth:
  //   - With real video at forward rates: <video> drives time via onTimeUpdate.
  //   - Without video, or at reverse rates (HTML5 video can't): rAF loop.
  useEffect(() => {
    const needsRaf = !hasRealVideo || rate < 0;
    if (!playing || !needsRaf) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (t: number) => {
      const dt = t - lastTickRef.current;
      lastTickRef.current = t;
      setCurrentMs((cur) => {
        const next = cur + dt * rate;
        if (next < 0) {
          setPlaying(false);
          return 0;
        }
        if (savedSelectRange && rate > 0 && next >= savedSelectRange.outMs) {
          setPlaying(false);
          if (hasRealVideo) playerRef.current?.seek(savedSelectRange.outMs);
          return savedSelectRange.outMs;
        }
        if (next >= reel.durationMs) {
          setPlaying(false);
          return reel.durationMs;
        }
        if (hasRealVideo) playerRef.current?.seek(next);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, rate, reel.durationMs, hasRealVideo, savedSelectRange]);

  // Forward pause + rate to the real video element for non-gesture paths
  // (reel change, video ended, rAF end-of-reel). play() is called
  // synchronously from keyboard/click handlers so the browser sees it as
  // user-initiated.
  useEffect(() => {
    if (!hasRealVideo) return;
    const p = playerRef.current;
    if (!p) return;
    if (rate < 0) {
      p.pause();
      return;
    }
    p.setRate(rate);
    if (!playing) p.pause();
  }, [playing, rate, hasRealVideo]);

  // Volume + mute.
  useEffect(() => {
    if (!hasRealVideo) return;
    playerRef.current?.setVolume(volume);
    playerRef.current?.setMuted(muted);
  }, [volume, muted, hasRealVideo]);

  // Reset playback when the reel changes.
  useEffect(() => {
    setCurrentMs(0);
    setPlaying(false);
    setInPoint(null);
    setOutPoint(null);
    setHighlight({ kind: "none" });
    setLocalSource(null);
    setSourceFallbackUrl(null);
    appliedSelectRef.current = null;
  }, [reelId]);

  const flash = useCallback((m: string) => {
    setShowFlash(m);
    setTimeout(() => setShowFlash(null), 1400);
  }, []);

  useEffect(() => {
    const selectId = searchParams.get("select");
    const inMs = Number(searchParams.get("in"));
    const outMs = Number(searchParams.get("out"));
    if (!selectId) return;
    if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return;
    const clampedIn = Math.max(0, Math.min(reel.durationMs, inMs));
    const clampedOut = Math.max(clampedIn, Math.min(reel.durationMs, outMs));
    const marker = `${selectId}:${clampedIn}:${clampedOut}`;
    if (appliedSelectRef.current !== marker) {
      appliedSelectRef.current = marker;
      setCurrentMs(clampedIn);
      setInPoint(clampedIn);
      setOutPoint(clampedOut);
      setHighlight({ kind: "select", inMs: clampedIn, outMs: clampedOut });
      flash(`SELECT · ${formatTcShort(clampedIn)} - ${formatTcShort(clampedOut)}`);
    }
    if (hasRealVideo) playerRef.current?.seek(clampedIn);
    flash(`SELECT · ${formatTcShort(clampedIn)} — ${formatTcShort(clampedOut)}`);
  }, [searchParams, reel.durationMs, hasRealVideo, flash]);

  // User-initiated seek — updates state AND tells the real video element to
  // jump. Distinct from setCurrentMs() called from onTimeUpdate, which must
  // not echo back into the video or playback stutters.
  const seekTo = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(reel.durationMs, ms));
      setCurrentMs(clamped);
      if (hasRealVideo) playerRef.current?.seek(clamped);
    },
    [reel.durationMs, hasRealVideo],
  );

  const handleSaveSelect = useCallback(async () => {
    if (inPoint == null || outPoint == null || outPoint <= inPoint) {
      flash("set IN and OUT first");
      return;
    }
    const seg = reel.analysis.segments.find(
      (s) => s.startMs <= inPoint && s.endMs >= inPoint,
    );
    const speakerId = seg?.speakerId ?? reel.analysis.speakers[0]?.id ?? "spk_unknown";
    const quote = (seg?.text ?? "").slice(0, 220);
    const id = `sel_${Math.random().toString(36).slice(2, 9)}`;
    await saveSelect(slug, {
      id,
      projectId: project.id,
      reelId: reel.id,
      sourcePath: reel.videoPath,
      inMs: inPoint,
      outMs: outPoint,
      speakerId,
      quote,
      notes: "",
      createdAt: new Date().toISOString(),
    });
    flash(`SAVED · ${formatTcShort(outPoint - inPoint)}`);
  }, [inPoint, outPoint, reel, project.id, slug, flash]);

  // ── Pipeline: Transcribe ──

  const handleTranscribe = useCallback(async () => {
    if (!hasRealVideo) {
      flash("Upload a video file first");
      return;
    }
    setPipeline({ step: "transcribing" });
    try {
      const videoPath = localSource?.url ?? (source.status === "real" ? source.url : null) ?? reel.videoPath ?? null;
      if (!videoPath) {
        setPipeline({ step: "idle", error: "No video source available" });
        return;
      }
      const res = await fetch(`/api/projects/${slug}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId: reel.id, videoPath }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "transcribe failed");
      }
      const data = (await res.json()) as { segments: TranscriptSegment[]; provider: string };
      replaceReelTranscript(slug, reel.id, data.segments ?? []);
      flash(`Transcribed · ${data.segments?.length ?? 0} segments · ${data.provider}`);
      setPipeline({ step: "idle" });
    } catch (e: unknown) {
      setPipeline({ step: "idle", error: (e as Error).message });
    }
  }, [hasRealVideo, reel, localSource, source, slug, flash]);

  // ── Pipeline: Analyze ──

  const handleAnalyze = useCallback(async () => {
    if (!reel.analysis.segments || reel.analysis.segments.length === 0) {
      flash("Transcribe first — no segments to analyze");
      return;
    }
    setPipeline({ step: "analyzing" });
    try {
      const res = await fetch(`/api/projects/${slug}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId: reel.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "analyze failed");
      }
      const data = await res.json();
      flash(`Analyzed · ${data.analysis?.themes?.length ?? 0} themes found`);
      // Refresh the page to load persisted analysis into the project store.
      window.location.reload();
    } catch (e: unknown) {
      setPipeline({ step: "idle", error: (e as Error).message });
    }
  }, [reel.analysis.segments, slug, reel.id, flash]);

  // Keyboard transport — Steenbeck shortcuts.
  // IMPORTANT: play() / pause() are called synchronously here so the browser
  // sees them as user-initiated. Calling them from a useEffect would fail
  // because the gesture's call stack has already unwound.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && ["INPUT", "TEXTAREA"].includes(tgt.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const p = playerRef.current;
      switch (e.key) {
        case " ":
          e.preventDefault();
          setPlaying((wasPlaying) => {
            if (wasPlaying) { p?.pause(); return false; }
            p?.play();
            return true;
          });
          setRate(1);
          break;
        case "j":
        case "J":
          setRate((r) => {
            const next = r > 0 ? -1 : Math.max(r * 2, -8);
            p?.setRate(next);
            return next;
          });
          p?.pause();
          setPlaying(true);
          break;
        case "k":
        case "K":
          p?.pause();
          setPlaying(false);
          setRate(1);
          break;
        case "l":
        case "L":
          setRate((r) => {
            const next = r < 0 ? 1 : Math.min(r * 2, 8);
            p?.setRate(next);
            return next;
          });
          p?.play();
          setPlaying(true);
          break;
        case "i":
        case "I":
          setInPoint(currentMs);
          flash(`IN · ${formatTc(currentMs)}`);
          break;
        case "o":
        case "O":
          setOutPoint(currentMs);
          flash(`OUT · ${formatTc(currentMs)}`);
          break;
        case "s":
        case "S":
          void handleSaveSelect();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekTo(currentMs - (e.shiftKey ? 5000 : 1000));
          break;
        case "ArrowRight":
          e.preventDefault();
          seekTo(currentMs + (e.shiftKey ? 5000 : 1000));
          break;
        case "m":
        case "M":
          setMuted((m) => !m);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentMs, reel.durationMs, flash, handleSaveSelect, seekTo]);

  // Auto-scroll transcript so the active line stays in view (respects rmotion).
  useEffect(() => {
    if (reduceMotion) return;
    const col = transcriptColRef.current;
    if (!col) return;
    const active = col.querySelector("[data-active='true']") as HTMLElement | null;
    if (!active) return;
    const colRect = col.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const delta = aRect.top - (colRect.top + colRect.height * 0.4);
    if (Math.abs(delta) > 40) {
      col.scrollBy({ top: delta, behavior: "smooth" });
    }
  }, [currentMs, reduceMotion]);

  const setCurrentFromTranscript = (ms: number) => seekTo(ms);

  const themes = reel.analysis.themes;
  const quotations = reel.analysis.quotations;
  const contradictions = reel.analysis.contradictions;
  const scenes = reel.analysis.scenes;
  const suggestedSelects = reel.analysis.suggestedSelects;
  const claims = reel.analysis.claims;
  const warnings = reel.analysis.contentWarnings;

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] bg-paper-warm">
      <ReelRail project={project} currentReelId={reel.id} slug={slug} />

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* PLAYER COLUMN */}
        <section className="flex min-h-[calc(100vh-120px)] flex-col border-r border-ink/20">
          <PlayerHeader reel={reel} project={project} />

          <div className="relative">
            <div className="crop-frame mx-6 mt-3">
              <span className="crop-bl" />
              <span className="crop-br" />
              <div className="relative aspect-video w-full border border-ink/80">
                <VideoPlayer
                  ref={playerRef}
                  src={effectiveSrc}
                  reel={reel}
                  currentMs={currentMs}
                  durationMs={reel.durationMs}
                  playing={playing}
                  rate={rate}
                  volume={volume}
                  muted={muted}
                  reduceMotion={reduceMotion}
                  onTimeUpdate={(ms) => {
                    if (hasRealVideo && rate >= 0) {
                      if (savedSelectRange && playing && ms >= savedSelectRange.outMs) {
                        playerRef.current?.pause();
                        setPlaying(false);
                        setCurrentMs(savedSelectRange.outMs);
                        playerRef.current?.seek(savedSelectRange.outMs);
                        return;
                      }
                      setCurrentMs(ms);
                    }
                  }}
                  onEnded={() => setPlaying(false)}
                  onError={() => {
                    if (!localSource && !sourceFallbackUrl && source.status === "real" && source.fallbackUrl) {
                      console.warn("[CUTROOM video] direct source failed; trying fallback media route", {
                        origin: source.origin,
                      });
                      setSourceFallbackUrl(source.fallbackUrl);
                      return;
                    }
                    setUploadStatus((prev) => ({ ...prev, error: "Video failed to load" }));
                  }}
                  onLoadedMetadata={() => {
                    const selectId = searchParams.get("select");
                    const selectInMs = Number(searchParams.get("in"));
                    if (selectId && Number.isFinite(selectInMs)) {
                      playerRef.current?.seek(Math.max(0, Math.min(reel.durationMs, selectInMs)));
                    } else if (currentMs > 0) {
                      playerRef.current?.seek(currentMs);
                    }
                  }}
                />
                <div className="pointer-events-none absolute inset-0">
                  <div className="pointer-events-auto absolute inset-0">
                    <DropZone
                      onFilePicked={handleLocalFile}
                      uploadInputRef={uploadInputRef}
                      hasRemoteSource={!!effectiveSrc}
                      sourceStatus={source.status}
                      uploadStatus={uploadStatus}
                    />
                  </div>
                </div>
              </div>
              <SourceTag source={source} localOrigin={localSource?.origin} />
              <div className="absolute -bottom-7 left-0 right-0 flex justify-between font-grotesk text-[10px] uppercase tracking-wider text-ink/70">
                <span>{reel.location}</span>
                <span>{new Date(reel.recordedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            </div>
          </div>

          <Transport
            currentMs={currentMs}
            durationMs={reel.durationMs}
            playing={playing}
            rate={rate}
            inPoint={inPoint}
            outPoint={outPoint}
            onScrub={seekTo}
            volume={volume}
            muted={muted}
            onVolume={setVolume}
            onMuteToggle={() => setMuted((m) => !m)}
            hasAudio={hasRealVideo}
            onTogglePlay={() => {
              const p = playerRef.current;
              setPlaying((wasPlaying) => {
                if (wasPlaying) { p?.pause(); return false; }
                p?.play();
                return true;
              });
              setRate(1);
            }}
            onJ={() => {
              const p = playerRef.current;
              setRate((r) => {
                const next = r > 0 ? -1 : Math.max(r * 2, -8);
                p?.setRate(next);
                return next;
              });
              p?.pause();
              setPlaying(true);
            }}
            onL={() => {
              const p = playerRef.current;
              setRate((r) => {
                const next = r < 0 ? 1 : Math.min(r * 2, 8);
                p?.setRate(next);
                return next;
              });
              p?.play();
              setPlaying(true);
            }}
            onIn={() => {
              setInPoint(currentMs);
              flash(`IN · ${formatTc(currentMs)}`);
            }}
            onOut={() => {
              setOutPoint(currentMs);
              flash(`OUT · ${formatTc(currentMs)}`);
            }}
            onSave={handleSaveSelect}
            onUpload={openFilePicker}
            onTranscribe={handleTranscribe}
            onAnalyze={handleAnalyze}
            pipeline={pipeline}
          />

          <SceneStrip
            scenes={scenes}
            durationMs={reel.durationMs}
            currentMs={currentMs}
            onJump={seekTo}
          />

          <div className="mt-auto border-t border-ink/30 px-6 py-3 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
            <Hotkeys />
          </div>
        </section>

        {/* TRANSCRIPT COLUMN — marked-up screenplay */}
        <section className="border-r border-ink/20 bg-paper">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/40 bg-paper-warm px-6 py-3">
            <div>
              <p className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Transcript</p>
              <p className="font-serif text-[15px]">{reel.label}</p>
            </div>
            <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/70">
              {reel.analysis.segments.length} lines · {reel.analysis.speakers.length} speakers
            </div>
          </div>
          <div
            ref={transcriptColRef}
            className="max-h-[calc(100vh-260px)] overflow-y-auto px-6 py-4"
          >
            <Transcript
              reel={reel}
              currentMs={currentMs}
              inPoint={inPoint}
              outPoint={outPoint}
              highlight={highlight}
              onSeek={setCurrentFromTranscript}
            />
            <p className="mt-8 border-t border-ink/30 pt-3 font-grotesk text-[9px] uppercase tracking-wider text-ink/55">
              END OF REEL — {formatTc(reel.durationMs)} —
            </p>
          </div>
        </section>

        {/* ANALYSIS COLUMN */}
        <aside className="overflow-y-auto px-5 py-4 lg:max-h-[calc(100vh-120px)]">
          <AnalysisPanel
            themes={themes}
            quotations={quotations}
            contradictions={contradictions}
            scenes={scenes}
            suggestedSelects={suggestedSelects}
            claims={claims}
            warnings={warnings}
            onHighlight={setHighlight}
            onJump={seekTo}
            onUseSuggested={async (ss) => {
              const segId = reel.analysis.segments.find(
                (s) => s.startMs <= ss.startMs && s.endMs >= ss.startMs,
              )?.id;
              await saveSelect(slug, {
                id: `sel_${Math.random().toString(36).slice(2, 9)}`,
                projectId: project.id,
                reelId: reel.id,
                inMs: ss.startMs,
                outMs: ss.endMs,
                speakerId: ss.speakerId,
                quote: reel.analysis.segments.find((s) => s.id === segId)?.text.slice(0, 220) ?? "",
                notes: ss.reason,
                createdAt: new Date().toISOString(),
              });
              flash("SELECT SAVED FROM CLAUDE");
            }}
          />
        </aside>
      </div>

      {showFlash && (
        <div className="pointer-events-none fixed left-1/2 top-[14%] z-50 -translate-x-1/2">
          <div className="edit-mark px-3 text-[14px]">{showFlash}</div>
        </div>
      )}

      <input
        ref={uploadInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.mxf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLocalFile(file);
          // reset so re-picking the same file fires onChange again
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PlayerHeader({ reel, project }: { reel: Reel; project: Project }) {
  return (
    <div className="flex items-end justify-between border-b border-ink/30 px-6 py-3">
      <div>
        <p className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Reel {reel.number.toString().padStart(2, "0")} — {project.title}</p>
        <h1 className="mt-0.5 font-serif text-[26px] leading-tight tracking-tight">{reel.label}</h1>
      </div>
      <div className="text-right font-grotesk text-[10px] uppercase tracking-wider text-ink/70">
        <div>{formatTc(reel.durationMs)}</div>
        <div className="mt-1">{reel.shotOn}</div>
      </div>
    </div>
  );
}

function Transport(props: {
  currentMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  inPoint: number | null;
  outPoint: number | null;
  onScrub: (ms: number) => void;
  onTogglePlay: () => void;
  onJ: () => void;
  onL: () => void;
  onIn: () => void;
  onOut: () => void;
  onSave: () => void;
  onUpload: () => void;
  onTranscribe: () => void;
  onAnalyze: () => void;
  pipeline: { step: "idle" | "transcribing" | "analyzing"; error?: string };
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onMuteToggle: () => void;
  hasAudio: boolean;
}) {
  const played = (props.currentMs / Math.max(1, props.durationMs)) * 100;
  return (
    <div className="px-6 pt-9">
      {/* IN/OUT band over the scrub bar */}
      <div className="relative h-2">
        {props.inPoint !== null && (
          <span
            className="absolute top-0 h-full border-l border-vermilion"
            style={{ left: `${(props.inPoint / props.durationMs) * 100}%`, width: 2 }}
            aria-label="IN point"
          />
        )}
        {props.outPoint !== null && (
          <span
            className="absolute top-0 h-full border-r border-vermilion"
            style={{ left: `${(props.outPoint / props.durationMs) * 100}%`, width: 2 }}
            aria-label="OUT point"
          />
        )}
        {props.inPoint !== null && props.outPoint !== null && props.outPoint > props.inPoint && (
          <span
            className="absolute top-0 h-full bg-vermilion/25"
            style={{
              left: `${(props.inPoint / props.durationMs) * 100}%`,
              width: `${((props.outPoint - props.inPoint) / props.durationMs) * 100}%`,
            }}
          />
        )}
      </div>
      <input
        type="range"
        className="scrub"
        style={{ ["--played" as string]: `${played}%` }}
        min={0}
        max={props.durationMs}
        step={40}
        value={props.currentMs}
        onChange={(e) => props.onScrub(parseInt(e.target.value, 10))}
        aria-label="Playhead"
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3 font-grotesk text-[11px] uppercase tracking-wider">
        {/* Transport group: J / K / L + status */}
        <div className="flex items-center gap-2">
          <TransportBtn label="J" onClick={props.onJ} />
          <TransportBtn label="K · pause" onClick={() => props.onTogglePlay()} active={!props.playing} />
          <TransportBtn label="L" onClick={props.onL} />
          <span className="ml-2 whitespace-nowrap text-ink/70">
            {props.playing ? `play · ${props.rate.toFixed(1)}x` : "hold"}
          </span>
        </div>

        {/* Timecode group */}
        <div className="tc whitespace-nowrap text-[12px]">
          {formatTc(props.currentMs)} <span className="text-ink/40">·</span> {formatTc(props.durationMs)}
        </div>

        {/* Audio group: M + volume */}
        <VolumeCluster
          volume={props.volume}
          muted={props.muted}
          onVolume={props.onVolume}
          onMuteToggle={props.onMuteToggle}
          hasAudio={props.hasAudio}
        />

        {/* Marking actions: I / O / S */}
        <div className="ml-auto flex items-center gap-2">
          <TransportBtn label="I · in" onClick={props.onIn} active={props.inPoint !== null} />
          <TransportBtn label="O · out" onClick={props.onOut} active={props.outPoint !== null} />
          <TransportBtn label="S · save select" onClick={props.onSave} solid />
        </div>
      </div>

      {/* Row 2: media pipeline actions */}
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-ink/15 pt-3 font-grotesk text-[11px] uppercase tracking-wider">
        <span className="text-ink/55">Media</span>
        <div className="flex flex-wrap items-center gap-2">
          <TransportBtn label="Upload file" onClick={props.onUpload} />
          <TransportBtn
            label={props.pipeline.step === "transcribing" ? "Transcribing…" : "Transcribe"}
            onClick={props.onTranscribe}
            active={props.pipeline.step === "transcribing"}
          />
          <TransportBtn
            label={props.pipeline.step === "analyzing" ? "Analyzing…" : "Analyze"}
            onClick={props.onAnalyze}
            active={props.pipeline.step === "analyzing"}
          />
        </div>
        {props.pipeline.error && (
          <div className="basis-full font-grotesk text-[10px] uppercase tracking-wider text-vermilion">
            Pipeline error: {props.pipeline.error}
          </div>
        )}
      </div>
    </div>
  );
}

function VolumeCluster({
  volume,
  muted,
  onVolume,
  onMuteToggle,
  hasAudio,
}: {
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onMuteToggle: () => void;
  hasAudio: boolean;
}) {
  const disabled = !hasAudio;
  return (
    <div
      className={
        "flex items-center gap-2" + (disabled ? " opacity-50" : "")
      }
      title={disabled ? "Audio available when a real video source is wired (set ?src= or PROJECT_DEFAULT_VIDEO_SRC)" : "M to mute / unmute"}
    >
      <button
        type="button"
        onClick={onMuteToggle}
        disabled={disabled}
        aria-pressed={muted}
        className="border border-ink/60 bg-paper px-2 py-1 font-grotesk text-[11px] uppercase tracking-wider hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink"
      >
        {muted || volume === 0 ? "MUTE" : "M"}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round((muted ? 0 : volume) * 100)}
        disabled={disabled}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10) / 100;
          onVolume(v);
          if (v > 0 && muted) onMuteToggle();
        }}
        className="h-1 w-24 cursor-pointer accent-vermilion disabled:cursor-not-allowed"
        aria-label="Volume"
      />
    </div>
  );
}

function SourceTag({ source, localOrigin }: { source: { status: "loading" | "real" | "none"; origin?: string }; localOrigin?: string }) {
  const label = localOrigin
    ? `Source · ${localOrigin}`
    : source.status === "loading"
      ? "Resolving source…"
      : source.status === "real"
        ? `Source · ${source.origin ?? "real"}`
        : "Source · surrogate (drag a video file to play)";
  return (
    <div className="pointer-events-none absolute -top-4 right-0 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
      {label}
    </div>
  );
}

function TransportBtn({
  label,
  onClick,
  active,
  solid,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  solid?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        solid
          ? "border border-ink bg-ink px-3 py-1.5 text-paper hover:bg-vermilion hover:border-vermilion"
          : active
            ? "border border-vermilion bg-vermilion/15 px-3 py-1.5 text-ink"
            : "border border-ink/60 bg-paper px-3 py-1.5 text-ink hover:bg-ink hover:text-paper"
      }
    >
      {label}
    </button>
  );
}

function SceneStrip({
  scenes,
  durationMs,
  currentMs,
  onJump,
}: {
  scenes: Reel["analysis"]["scenes"];
  durationMs: number;
  currentMs: number;
  onJump: (ms: number) => void;
}) {
  return (
    <div className="mt-6 border-y border-ink/30 bg-paper px-6 py-3">
      <p className="mb-2 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Scene strip</p>
      <div className="relative h-9 border border-ink/40 bg-ink/5">
        {scenes.map((s, i) => {
          const left = (s.startMs / durationMs) * 100;
          const width = ((s.endMs - s.startMs) / durationMs) * 100;
          const active = currentMs >= s.startMs && currentMs < s.endMs;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(s.startMs)}
              title={`${s.title} — ${s.narrativeRole.replace("_", " ")}`}
              className={
                active
                  ? "absolute inset-y-0 border-r border-ink/30 bg-vermilion/25 px-1 text-left font-grotesk text-[10px] uppercase tracking-wider text-ink"
                  : "absolute inset-y-0 border-r border-ink/30 px-1 text-left font-grotesk text-[10px] uppercase tracking-wider text-ink/85 hover:bg-ink/10"
              }
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {i + 1}. {s.title}
            </button>
          );
        })}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1 bottom-[-4px] w-[2px] bg-vermilion"
          style={{ left: `${(currentMs / durationMs) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Hotkeys() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
      <span>SPACE — play/hold</span>
      <span>J / K / L — reverse / pause / forward</span>
      <span>I / O — set in / out</span>
      <span>S — save select</span>
      <span>← / → — nudge 1s (⇧ for 5s)</span>
      <span>M — mute / unmute</span>
      <span>Click a word — seek</span>
    </div>
  );
}

function Transcript({
  reel,
  currentMs,
  inPoint,
  outPoint,
  highlight,
  onSeek,
}: {
  reel: Reel;
  currentMs: number;
  inPoint: number | null;
  outPoint: number | null;
  highlight: Highlight;
  onSeek: (ms: number) => void;
}) {
  const supportingSet = useMemo(() => {
    if (highlight.kind !== "segment") return new Set<string>();
    return new Set(highlight.segmentIds);
  }, [highlight]);

  return (
    <div className="space-y-5 font-serif text-[16px] leading-[1.55]">
      {reel.analysis.segments.map((seg) => (
        <SegmentBlock
          key={seg.id}
          seg={seg}
          speaker={reel.analysis.speakers.find((s) => s.id === seg.speakerId)?.name ?? seg.speakerId}
          currentMs={currentMs}
          inPoint={inPoint}
          outPoint={outPoint}
          supporting={supportingSet.has(seg.id)}
          highlightSelect={highlight.kind === "select" ? { inMs: highlight.inMs, outMs: highlight.outMs } : null}
          onSeek={onSeek}
        />
      ))}
    </div>
  );
}

function SegmentBlock({
  seg,
  speaker,
  currentMs,
  inPoint,
  outPoint,
  supporting,
  highlightSelect,
  onSeek,
}: {
  seg: TranscriptSegment;
  speaker: string;
  currentMs: number;
  inPoint: number | null;
  outPoint: number | null;
  supporting: boolean;
  highlightSelect: { inMs: number; outMs: number } | null;
  onSeek: (ms: number) => void;
}) {
  const active = currentMs >= seg.startMs && currentMs < seg.endMs;
  return (
    <div data-active={active} className="grid grid-cols-[88px_1fr] gap-4">
      <div className="text-right">
        <button
          type="button"
          onClick={() => onSeek(seg.startMs)}
          className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65 hover:text-ink hover:underline"
        >
          {formatTcShort(seg.startMs)}
        </button>
        <div className="mt-0.5 font-grotesk text-[10px] uppercase tracking-[0.22em] text-ink">{speaker}</div>
      </div>
      <p className={supporting ? "transcript-line border-l-2 border-vermilion pl-3" : "transcript-line"}>
        {seg.words.map((w, i) => {
          const wActive = currentMs >= w.startMs && currentMs < w.endMs;
          const inSelect =
            (inPoint !== null && outPoint !== null && outPoint > inPoint && w.startMs >= inPoint && w.endMs <= outPoint) ||
            (highlightSelect !== null && w.startMs >= highlightSelect.inMs && w.endMs <= highlightSelect.outMs);
          return (
            <span key={i}>
              <span
                role="button"
                tabIndex={0}
                onClick={() => onSeek(w.startMs)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSeek(w.startMs);
                  }
                }}
                className={
                  "transcript-word cursor-pointer" +
                  (wActive ? " active" : "") +
                  (inSelect ? " in-select" : "") +
                  (supporting && !wActive && !inSelect ? " in-supporting" : "")
                }
              >
                {w.word}
              </span>
              {" "}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function AnalysisPanel({
  themes,
  quotations,
  contradictions,
  scenes,
  suggestedSelects,
  claims,
  warnings,
  onHighlight,
  onJump,
  onUseSuggested,
}: {
  themes: Theme[];
  quotations: Quotation[];
  contradictions: { id: string; summary: string; claimAId: string; claimBId: string }[];
  scenes: Reel["analysis"]["scenes"];
  suggestedSelects: Reel["analysis"]["suggestedSelects"];
  claims: Reel["analysis"]["claims"];
  warnings: string[];
  onHighlight: (h: Highlight) => void;
  onJump: (ms: number) => void;
  onUseSuggested: (s: Reel["analysis"]["suggestedSelects"][number]) => void;
}) {
  return (
    <div className="space-y-7 font-serif text-[14px] leading-snug">
      <PanelHeading kicker="Claude's read" title="Themes" />
      <ul className="space-y-3">
        {themes.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onHighlight({ kind: "segment", segmentIds: t.supportingSegmentIds })}
              onMouseEnter={() => onHighlight({ kind: "segment", segmentIds: t.supportingSegmentIds })}
              onMouseLeave={() => onHighlight({ kind: "none" })}
              className="block w-full border-l-2 border-ink/20 pl-3 text-left hover:border-vermilion"
            >
              <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
                {t.supportingSegmentIds.length} citations
              </span>
              <div className="font-serif italic">{t.name}</div>
              <p className="mt-1 text-[13px] text-ink/85">{t.summary}</p>
            </button>
          </li>
        ))}
      </ul>

      <PanelHeading kicker="Pulled by Claude" title="Quotable" />
      <ul className="space-y-3">
        {quotations.map((q) => (
          <li key={q.id} className="border-l-2 border-ink/20 pl-3">
            <p className={q.weight === "headline" ? "font-serif italic text-[16px]" : "font-serif italic"}>
              &ldquo;{q.text}&rdquo;
            </p>
            <div className="mt-1 flex items-center justify-between font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
              <span>{q.weight}</span>
              <button
                type="button"
                onClick={() => onJump(q.startMs)}
                onMouseEnter={() => onHighlight({ kind: "segment", segmentIds: [q.segmentId] })}
                onMouseLeave={() => onHighlight({ kind: "none" })}
                className="hover:text-vermilion hover:underline"
              >
                {formatTcShort(q.startMs)}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {contradictions.length > 0 && (
        <>
          <PanelHeading kicker="Watch" title="Contradictions" />
          <ul className="space-y-3">
            {contradictions.map((c) => (
              <li key={c.id} className="border border-vermilion/40 bg-vermilion/5 p-3">
                <p className="font-serif text-[13px]">{c.summary}</p>
                <div className="mt-2 flex gap-2 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
                  <span>{c.claimAId}</span>
                  <span>↔</span>
                  <span>{c.claimBId}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <PanelHeading kicker="Suggested selects" title="From Claude" />
      <ul className="space-y-2">
        {suggestedSelects.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 border-l-2 border-ink/20 pl-3">
            <div className="flex-1">
              <p className="font-serif text-[13px] text-ink/90">{s.reason}</p>
              <button
                type="button"
                onClick={() => onJump(s.startMs)}
                onMouseEnter={() => onHighlight({ kind: "select", inMs: s.startMs, outMs: s.endMs })}
                onMouseLeave={() => onHighlight({ kind: "none" })}
                className="mt-1 font-grotesk text-[10px] uppercase tracking-wider text-ink/70 hover:text-vermilion hover:underline"
              >
                {formatTcShort(s.startMs)} — {formatTcShort(s.endMs)}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onUseSuggested(s)}
              className="border border-ink bg-paper px-2 py-1 font-grotesk text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper"
            >
              save
            </button>
          </li>
        ))}
      </ul>

      <PanelHeading kicker="Asserted on camera" title="Claims" />
      <ul className="space-y-2 text-[13px]">
        {claims.map((c) => (
          <li key={c.id} className="border-l-2 border-ink/20 pl-3">
            <p className="font-serif italic">&ldquo;{c.statement}&rdquo;</p>
            <div className="mt-1 font-grotesk text-[10px] uppercase tracking-wider text-ink/60">
              {c.confidence} · {c.segmentId}
            </div>
          </li>
        ))}
      </ul>

      <PanelHeading kicker="Scenes" title="Beat sheet" />
      <ol className="space-y-2 text-[13px]">
        {scenes.map((s, i) => (
          <li key={s.id} className="flex items-start gap-3">
            <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">{(i + 1).toString().padStart(2, "0")}</span>
            <div>
              <button
                type="button"
                onClick={() => onJump(s.startMs)}
                className="font-serif italic hover:text-vermilion"
              >
                {s.title}
              </button>
              <p className="text-ink/75">{s.description}</p>
              <p className="mt-1 font-grotesk text-[10px] uppercase tracking-wider text-ink/60">
                {s.narrativeRole.replace("_", " ")} · {formatTcShort(s.startMs)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {warnings.length > 0 && (
        <div className="border-t border-ink/30 pt-4 font-grotesk text-[10px] uppercase tracking-wider text-ink/65">
          Content notes: {warnings.join(" · ")}
        </div>
      )}
    </div>
  );
}

function PanelHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="border-b border-ink/30 pb-1">
      <div className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">{kicker}</div>
      <div className="font-serif text-[18px] leading-none tracking-tight">{title}</div>
    </div>
  );
}

function ReelRail({
  project,
  currentReelId,
  slug,
}: {
  project: Project;
  currentReelId: string;
  slug: string;
}) {
  return (
    <aside
      aria-label="Reel index"
      className="sticky top-[88px] flex h-[calc(100vh-120px)] flex-col items-center border-r border-ink/30 bg-paper py-3"
    >
      <div className="mb-3 rotate-180 font-grotesk text-[10px] uppercase tracking-[0.32em] text-ink/65" style={{ writingMode: "vertical-rl" }}>
        Reels
      </div>
      <ul className="flex-1 space-y-2">
        {project.reels.map((r) => (
          <li key={r.id}>
            <Link
              href={`/projects/${slug}/screening/${r.id}`}
              className={
                r.id === currentReelId
                  ? "relative flex h-12 w-12 items-center justify-center border-2 border-vermilion bg-ink font-grotesk text-[14px] tracking-wider text-paper"
                  : "relative flex h-12 w-12 items-center justify-center border border-ink/60 bg-paper-warm font-grotesk text-[14px] tracking-wider text-ink hover:bg-ink hover:text-paper"
              }
              title={r.label}
            >
              {r.number.toString().padStart(2, "0")}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3 font-grotesk text-[10px] uppercase tracking-wider text-ink/60">
        {project.reels.length}
      </div>
    </aside>
  );
}

function usePrefersReducedMotion(): boolean {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setV(mq.matches);
    const onChange = () => setV(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return v;
}
