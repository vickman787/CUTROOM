import type {
  AdapterMode,
  ArchiveEntry,
  PaperEditEntry,
  Project,
  Reel,
  ReelAnalysis,
  Select,
  Treatment,
} from "@/domain/types";

// Discoverable mode for the discreet badge in the archive ledger.
export interface ModeReport {
  mode: AdapterMode;
  shelby: AdapterMode;
  claude: AdapterMode;
  aptos: AdapterMode;
  persistence: AdapterMode;
  transcription: AdapterMode;
  transcriptionProvider: string;
  missing: string[]; // env vars not set, e.g. ["ANTHROPIC_API_KEY (Claude analysis)"]
  note: string; // human-readable, e.g. "All adapters running in local-mock mode."
}

// ───────────────────────────── Shelby ─────────────────────────────

export interface ShelbyUploadHandle {
  uploadId: string;
  blobPath: string;
  commitment: string;
  sizeBytes: number;
  status: "uploading" | "sealed" | "expired";
  mode: AdapterMode;
}

export interface ShelbyUploadProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  status: "uploading" | "sealed" | "failed";
  error?: string;
}

export interface ShelbyDownload {
  readable: ReadableStream;
  contentLength: number;
  contentType?: string;
}

export interface ShelbyAdapter {
  mode: AdapterMode;
  startUpload(args: { fileName: string; sizeBytes: number; kind: ArchiveEntry["kind"]; projectId: string }): Promise<ShelbyUploadHandle>;
  appendChunk(uploadId: string, chunk: Uint8Array, offset: number): Promise<ShelbyUploadProgress>;
  seal(uploadId: string): Promise<ShelbyUploadHandle>;
  resolve(blobPath: string): Promise<{ url: string } | null>;
  download?(blobPath: string, range?: { start: number; end?: number }): Promise<ShelbyDownload | null>;
  list(projectId: string): Promise<ArchiveEntry[]>;
}

// ───────────────────────────── Claude ─────────────────────────────

export interface ClaudeAdapter {
  mode: AdapterMode;
  analyzeReel(args: {
    reelId: string;
    label: string;
    speakers: { id: string; name: string; role: string }[];
    rawTranscript: string;
    runtimeMs: number;
  }): Promise<ReelAnalysis>;
}

// ───────────────────────────── Aptos ──────────────────────────────

export interface AptosWalletSession {
  address: string;
  network: "mainnet" | "testnet" | "local-mock";
  publicKey: string;
  connectedAt: string;
  mode: AdapterMode;
}

export interface AptosAdapter {
  mode: AdapterMode;
  connect(): Promise<AptosWalletSession>;
  current(): Promise<AptosWalletSession | null>;
  disconnect(): Promise<void>;
}

// ───────────────────────────── Persistence ─────────────────────────

export interface PersistenceAdapter {
  mode: AdapterMode;
  listProjects(): Promise<Project[]>;
  getProject(slug: string): Promise<Project | null>;
  createProject(project: Project): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  updateReel(projectId: string, reelId: string, data: { videoPath?: string }): Promise<Reel>;
  updateReelAnalysis(projectId: string, reelId: string, analysis: ReelAnalysis): Promise<Reel>;
  upsertSelect(s: Select): Promise<Select>;
  removeSelect(projectId: string, selectId: string): Promise<void>;
  replacePaperEdit(projectId: string, entries: PaperEditEntry[]): Promise<PaperEditEntry[]>;
  upsertTreatment(t: Treatment): Promise<Treatment>;
  appendArchive(e: ArchiveEntry): Promise<ArchiveEntry>;
  removeArchive(projectId: string, entryId: string): Promise<void>;
}

export interface AdapterBundle {
  shelby: ShelbyAdapter;
  claude: ClaudeAdapter;
  aptos: AptosAdapter;
  persistence: PersistenceAdapter;
  transcription: import("./transcription").TranscriptionAdapter;
  report: ModeReport;
}
