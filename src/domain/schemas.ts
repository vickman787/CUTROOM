// Zod schemas matching the analysis contract returned by adapters/claude.ts.
// The structure is enforced at the trust boundary (model output) and again at
// the persistence layer so the UI can rely on the shape.

import { z } from "zod";

export const TranscriptWordSchema = z.object({
  word: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  speakerId: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  text: z.string(),
  words: z.array(TranscriptWordSchema),
});

export const SpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
});

export const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  description: z.string(),
  narrativeRole: z.enum([
    "exposition",
    "rising_action",
    "complication",
    "climax",
    "resolution",
    "reflection",
  ]),
});

export const ThemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  supportingSegmentIds: z.array(z.string()),
});

export const ClaimSchema = z.object({
  id: z.string(),
  statement: z.string(),
  speakerId: z.string(),
  segmentId: z.string(),
  confidence: z.enum(["asserted", "implied", "speculative"]),
});

export const ContradictionSchema = z.object({
  id: z.string(),
  summary: z.string(),
  claimAId: z.string(),
  claimBId: z.string(),
});

export const QuotationSchema = z.object({
  id: z.string(),
  text: z.string(),
  speakerId: z.string(),
  segmentId: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  weight: z.enum(["headline", "supporting", "color"]),
});

export const SuggestedSelectSchema = z.object({
  id: z.string(),
  reason: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  speakerId: z.string(),
});

export const ReelAnalysisSchema = z.object({
  speakers: z.array(SpeakerSchema),
  segments: z.array(TranscriptSegmentSchema),
  scenes: z.array(SceneSchema),
  themes: z.array(ThemeSchema),
  claims: z.array(ClaimSchema),
  contradictions: z.array(ContradictionSchema),
  quotations: z.array(QuotationSchema),
  contentWarnings: z.array(z.string()),
  suggestedSelects: z.array(SuggestedSelectSchema),
});

export type ReelAnalysisInput = z.infer<typeof ReelAnalysisSchema>;
