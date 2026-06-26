import { readFile } from "node:fs/promises";
import type {
  TranscriptSegment,
  TranscriptWord,
  AdapterMode,
} from "@/domain/types";

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  language: string;
  durationMs: number;
}

export interface TranscriptionAdapter {
  mode: AdapterMode;
  provider: string;
  /** Submits an audio URL (or blob URL) and returns timestamped segments. */
  transcribe(args: { audioUrl: string; reelId: string }): Promise<TranscriptionResult>;
}

// ───────────── Mock ─────────────

export class TranscriptionMockAdapter implements TranscriptionAdapter {
  mode = "local-mock" as const;
  provider = "mock-local";

  async transcribe({ audioUrl, reelId }: { audioUrl: string; reelId: string }): Promise<TranscriptionResult> {
    const name = audioUrl.split("/").pop() ?? "untitled";
    const text = `Mock transcription of ${name}. Replace by setting TRANSCRIPTION_API_KEY.`;
    const words = text.split(/\s+/);
    const wordsMs: TranscriptWord[] = [];
    let cursor = 0;
    for (const w of words) {
      const start = cursor;
      const dur = Math.max(220, w.length * 60);
      cursor = start + dur;
      wordsMs.push({ word: w, startMs: start, endMs: start + dur });
    }
    const seg: TranscriptSegment = {
      id: `${reelId}_mockseg`,
      speakerId: "spk_unknown",
      startMs: 0,
      endMs: cursor,
      text,
      words: wordsMs,
    };
    return { segments: [seg], language: "en", durationMs: cursor };
  }
}

// ───────────── Deepgram ─────────────

interface DGWord {
  word: string;
  start: number; // seconds
  end: number;   // seconds
  speaker?: number;
  confidence?: number;
}

interface DGUtterance {
  start: number; // seconds
  end: number;   // seconds
  confidence?: number;
  speaker?: number;
  words: DGWord[];
  transcript?: string;
}

interface DGResponse {
  results?: {
    utterances?: DGUtterance[];
  };
}

export class DeepgramTranscriptionAdapter implements TranscriptionAdapter {
  mode = "live" as const;
  provider = "deepgram";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe({ audioUrl, reelId }: { audioUrl: string; reelId: string }): Promise<TranscriptionResult> {
    let body: ArrayBuffer;
    const contentType = "video/mp4";
    if (audioUrl.startsWith("/uploads/") || audioUrl.startsWith("public/") || audioUrl.startsWith("file:")) {
      const fsPath = audioUrl.startsWith("public/")
        ? audioUrl
        : audioUrl.startsWith("file:")
          ? audioUrl.slice(5)
          : `public${audioUrl}`;
      const buf = await readFile(fsPath);
      body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    } else if (/^https?:\/\//.test(audioUrl)) {
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
      body = await res.arrayBuffer();
    } else {
      const buf = await readFile(audioUrl);
      body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }

    const params = new URLSearchParams({
      model: "nova-2",
      smart_format: "true",
      diarize: "true",
      utterances: "true",
    });

    const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.apiKey}`,
        "Content-Type": contentType,
      },
      body: new Blob([body], { type: contentType }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Deepgram error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as DGResponse;
    const utterances = data.results?.utterances ?? [];

    if (utterances.length === 0) {
      return { segments: [], language: "en", durationMs: 0 };
    }

    const segments = utterances.map((u, i) => {
      const startMs = Math.round(u.start * 1000);
      const endMs = Math.round(u.end * 1000);
      const speakerLabel = u.speaker !== undefined ? `spk_${u.speaker}` : "spk_unknown";
      const text = u.words.map((w) => w.word).join(" ");
      const words: TranscriptWord[] = u.words.map((w) => ({
        word: w.word,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
      }));

      return {
        id: `${reelId}_deepgram_${i}`,
        speakerId: speakerLabel,
        startMs,
        endMs,
        text,
        words,
      };
    });

    const durationMs = segments.length > 0 ? segments[segments.length - 1].endMs : 0;

    return {
      segments,
      language: "en",
      durationMs,
    };
  }
}

// ───────────── AssemblyAI ─────────────

interface AAIWord {
  text: string;
  start: number; // ms
  end: number;   // ms
  speaker?: string;
}

export class AssemblyAITranscriptionAdapter implements TranscriptionAdapter {
  mode = "live" as const;
  provider = "assemblyai";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe({ audioUrl, reelId }: { audioUrl: string; reelId: string }): Promise<TranscriptionResult> {
    const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: audioUrl, speaker_labels: true, punctuate: true, format_text: true }),
    });
    if (!submitRes.ok) {
      throw new Error(`AssemblyAI submit failed: ${submitRes.status} ${await submitRes.text()}`);
    }
    const submitted = (await submitRes.json()) as { id: string };
    const id = submitted.id;

    const start = Date.now();
    while (Date.now() - start < 5 * 60_000) {
      await new Promise((r) => setTimeout(r, 2500));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { Authorization: this.apiKey },
      });
      if (!pollRes.ok) {
        throw new Error(`AssemblyAI poll failed: ${pollRes.status} ${await pollRes.text()}`);
      }
      const poll = (await pollRes.json()) as {
        status: "queued" | "processing" | "completed" | "error";
        error?: string;
        audio_duration?: number;
        words?: AAIWord[];
      };
      if (poll.status === "error") {
        throw new Error(`AssemblyAI returned error: ${poll.error}`);
      }
      if (poll.status === "completed") {
        const words = poll.words ?? [];
        const segments = groupWordsBySpeaker(words, reelId);
        return {
          segments,
          language: "en",
          durationMs: Math.round((poll.audio_duration ?? 0) * 1000),
        };
      }
    }
    throw new Error("AssemblyAI transcription timed out after 5 minutes.");
  }
}

function groupWordsBySpeaker(words: AAIWord[], reelId: string): TranscriptSegment[] {
  const segs: TranscriptSegment[] = [];
  let cur: AAIWord[] = [];
  let curSpeaker: string | undefined;
  const flush = () => {
    if (cur.length === 0) return;
    const id = `${reelId}_seg${segs.length + 1}`;
    const text = cur.map((w) => w.text).join(" ");
    segs.push({
      id,
      speakerId: curSpeaker ? `spk_${curSpeaker.toLowerCase()}` : "spk_unknown",
      startMs: cur[0].start,
      endMs: cur[cur.length - 1].end,
      text,
      words: cur.map((w) => ({ word: w.text, startMs: w.start, endMs: w.end })),
    });
    cur = [];
  };
  for (const w of words) {
    if (curSpeaker !== undefined && w.speaker && w.speaker !== curSpeaker) {
      flush();
    }
    curSpeaker = w.speaker ?? curSpeaker;
    cur.push(w);
  }
  flush();
  return segs;
}

// ───────────── Factory ─────────────

export function makeTranscriptionAdapter(): TranscriptionAdapter {
  const provider = (process.env.TRANSCRIPTION_PROVIDER ?? "").toLowerCase();
  const key = process.env.TRANSCRIPTION_API_KEY;
  if (!key) return new TranscriptionMockAdapter();
  if (provider === "deepgram") return new DeepgramTranscriptionAdapter(key);
  if (provider === "assemblyai") return new AssemblyAITranscriptionAdapter(key);
  return new TranscriptionMockAdapter();
}
