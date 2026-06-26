// CUTROOM domain types. The shapes here are produced by every adapter
// (mock and real) so the UI never branches on environment.

export type Milliseconds = number;

export interface Speaker {
  id: string;
  name: string;
  role: string;
}

export interface TranscriptWord {
  word: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
  text: string;
  words: TranscriptWord[];
}

export interface Scene {
  id: string;
  title: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
  description: string;
  narrativeRole: NarrativeRole;
}

export type NarrativeRole =
  | "exposition"
  | "rising_action"
  | "complication"
  | "climax"
  | "resolution"
  | "reflection";

export interface Theme {
  id: string;
  name: string;
  summary: string;
  supportingSegmentIds: string[];
}

export interface Claim {
  id: string;
  statement: string;
  speakerId: string;
  segmentId: string;
  confidence: "asserted" | "implied" | "speculative";
}

export interface Contradiction {
  id: string;
  summary: string;
  claimAId: string;
  claimBId: string;
}

export interface Quotation {
  id: string;
  text: string;
  speakerId: string;
  segmentId: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
  weight: "headline" | "supporting" | "color";
}

export interface SuggestedSelect {
  id: string;
  reason: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
  speakerId: string;
}

export interface ReelAnalysis {
  speakers: Speaker[];
  segments: TranscriptSegment[];
  scenes: Scene[];
  themes: Theme[];
  claims: Claim[];
  contradictions: Contradiction[];
  quotations: Quotation[];
  contentWarnings: string[];
  suggestedSelects: SuggestedSelect[];
}

export interface Reel {
  id: string;
  number: number;
  label: string;
  shotOn: string;
  location: string;
  durationMs: Milliseconds;
  recordedAt: string; // ISO
  posterPalette: [string, string, string]; // CSS colors for generated frame placeholders
  videoPath?: string; // local file path or Shelby blob path for the uploaded source file
  analysis: ReelAnalysis;
}

export interface Select {
  id: string;
  projectId: string;
  reelId: string;
  sourcePath?: string; // exact video/blob path this select was cut from
  inMs: Milliseconds;
  outMs: Milliseconds;
  speakerId: string;
  quote: string;
  notes: string;
  createdAt: string;
}

export type Act = 1 | 2 | 3;

export interface PaperEditEntry {
  id: string;
  projectId: string;
  selectId: string;
  act: Act;
  position: number;
  beat: string;
}

export interface TreatmentCitation {
  reelId: string;
  segmentId: string;
  startMs: Milliseconds;
  endMs: Milliseconds;
}

export interface TreatmentParagraph {
  id: string;
  act: Act | 0; // 0 = preface / logline section
  heading?: string;
  body: string;
  citations: TreatmentCitation[];
}

export interface Treatment {
  projectId: string;
  logline: string;
  paragraphs: TreatmentParagraph[];
  updatedAt: string;
}

export interface ArchiveEntry {
  id: string;
  projectId: string;
  kind: "footage" | "transcript" | "treatment" | "manifest";
  label: string;
  blobPath: string;
  owner: string;
  commitment: string;
  status: "sealed" | "warming" | "draft" | "expiring";
  sizeBytes: number;
  expiresAt: string;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  logline: string;
  director: string;
  productionCompany: string;
  shotAround: string;
  reels: Reel[];
  selects: Select[];
  paperEdit: PaperEditEntry[];
  treatment: Treatment;
  archive: ArchiveEntry[];
  mode: AdapterMode;
}

export type AdapterMode = "local-mock" | "live";
