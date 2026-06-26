"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

// Drop zone overlays the surrogate frame when no remote source is wired.
// Drag a video file or click to browse. The hidden <input> is owned by the
// ScreeningRoom so the transport bar's "Upload file" button can trigger it too.

interface Props {
  onFilePicked: (file: File) => void;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  hasRemoteSource: boolean;
  sourceStatus: "loading" | "real" | "none";
  uploadStatus?: { status: "idle" | "uploading" | "done"; fileName?: string; sizeBytes?: number; error?: string };
}

export function DropZone({ onFilePicked, uploadInputRef, hasRemoteSource, sourceStatus, uploadStatus }: Props) {
  const [dragOver, setDragOver] = useState(false);

  // When hasRemoteSource is true, the video is playing from a remote or local
  // URL — hide the full drop zone and show only a compact status strip.
  if (hasRemoteSource || sourceStatus === "real") {
    if (uploadStatus && uploadStatus.status !== "idle") {
      return <FileStatusBar uploadStatus={uploadStatus} />;
    }
    return null;
  }

  if (sourceStatus === "loading") return null;

  const error = uploadStatus?.error;

  return (
    <button
      type="button"
      onClick={() => uploadInputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFilePicked(file);
      }}
      className={
        "flex h-full w-full flex-col items-center justify-center gap-3 border-2 border-dashed transition-colors" +
        (dragOver
          ? " border-vermilion bg-vermilion/10"
          : " border-ink/40 bg-paper-warm/70 hover:border-ink/80")
      }
    >
      {error ? (
        <>
          <span className="font-grotesk text-[11px] uppercase tracking-wider text-vermilion">{error}</span>
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/70">Tap to try a different file.</span>
        </>
      ) : (
        <>
          <span aria-hidden className="text-[32px] opacity-60">&#x23F9;&#xFE0E;</span>
          <span className="font-grotesk text-[12px] uppercase tracking-wider text-ink/70">
            Drag a video file here, or click to browse
          </span>
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/55">
            .mp4 .webm .mov .mkv .avi .mxf
          </span>
        </>
      )}
    </button>
  );
}

function FileStatusBar({ uploadStatus }: { uploadStatus: NonNullable<Props["uploadStatus"]> }) {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center justify-between bg-ink/85 px-3 py-1.5 font-grotesk text-[10px] uppercase tracking-wider text-paper/90">
      <span>
        {uploadStatus.fileName ?? "file"} {uploadStatus.sizeBytes !== undefined ? `· ${formatLocalBytes(uploadStatus.sizeBytes)}` : ""}
        {uploadStatus.status === "uploading" && " · uploading…"}
        {uploadStatus.status === "done" && " · saved to server"}
      </span>
      {uploadStatus.error && <span className="text-vermilion">{uploadStatus.error}</span>}
    </div>
  );
}

function formatLocalBytes(n: number): string {
  if (n < 1e6) return `${(n / 1e3).toFixed(0)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e9).toFixed(2)} GB`;
}
