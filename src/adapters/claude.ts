import Anthropic from "@anthropic-ai/sdk";
import { ReelAnalysisSchema, type ReelAnalysisInput } from "@/domain/schemas";
import type { ReelAnalysis } from "@/domain/types";
import type { ClaudeAdapter } from "./types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";

// Mock Claude adapter. Selected only when USE_MOCK_AI=true.

export class ClaudeMockAdapter implements ClaudeAdapter {
  mode = "local-mock" as const;

  async analyzeReel(args: {
    reelId: string;
    label: string;
    speakers: { id: string; name: string; role: string }[];
    rawTranscript: string;
    runtimeMs: number;
  }): Promise<ReelAnalysis> {
    const speakerId = args.speakers[0]?.id ?? "spk_unknown";
    const speakerName = args.speakers[0]?.name ?? "Speaker";
    const segId = `${args.reelId}_seg1`;
    const fullText = args.rawTranscript.trim() || `Untranscribed reel "${args.label}".`;
    const words = fullText.split(/\s+/).slice(0, 64);
    const cursor = { ms: 0 };
    const segmentWords = words.map((w) => {
      const start = cursor.ms;
      const end = start + Math.max(220, w.length * 60);
      cursor.ms = end;
      return { word: w, startMs: start, endMs: end };
    });
    const endMs = cursor.ms || Math.min(args.runtimeMs, 30_000);

    return {
      speakers: args.speakers,
      segments: [
        {
          id: segId,
          speakerId,
          startMs: 0,
          endMs,
          text: words.join(" "),
          words: segmentWords,
        },
      ],
      scenes: [
        {
          id: `${args.reelId}_sc1`,
          title: args.label,
          startMs: 0,
          endMs: args.runtimeMs,
          description: `Auto-detected scene for ${args.label}.`,
          narrativeRole: "exposition",
        },
      ],
      themes: [
        {
          id: `${args.reelId}_th1`,
          name: "Recurring imagery",
          summary: "Mock analysis — supply ANTHROPIC_API_KEY for a real read.",
          supportingSegmentIds: [segId],
        },
      ],
      claims: [],
      contradictions: [],
      quotations: [
        {
          id: `${args.reelId}_q1`,
          text: words.slice(0, 14).join(" "),
          speakerId,
          segmentId: segId,
          startMs: 0,
          endMs: Math.min(endMs, 8_000),
          weight: "headline",
        },
      ],
      contentWarnings: [],
      suggestedSelects: [
        {
          id: `${args.reelId}_ss1`,
          reason: `Possible opener (mock) · ${speakerName}`,
          startMs: 0,
          endMs: Math.min(endMs, 12_000),
          speakerId,
        },
      ],
    };
  }
}

// ── Real Claude adapter ───────────────────────────────────────────────

export class ClaudeUnavailableAdapter implements ClaudeAdapter {
  mode = "live" as const;

  async analyzeReel(): Promise<ReelAnalysis> {
    throw new Error(
      "ANTHROPIC_API_KEY is required for CUTROOM analysis. Set USE_MOCK_AI=true only when you intentionally want mock analysis.",
    );
  }
}

// JSON Schema for the submit_analysis tool input. We define this in JSON
// Schema (not Zod) because the Anthropic API expects JSON Schema for tool
// input_schema. The shape mirrors ReelAnalysisSchema exactly.
const ANALYSIS_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    speakers: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
          role: { type: "string" as const },
        },
        required: ["id", "name", "role"],
      },
    },
    segments: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          speakerId: { type: "string" as const },
          startMs: { type: "integer" as const, minimum: 0 },
          endMs: { type: "integer" as const, minimum: 0 },
          text: { type: "string" as const },
          words: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                word: { type: "string" as const },
                startMs: { type: "integer" as const, minimum: 0 },
                endMs: { type: "integer" as const, minimum: 0 },
              },
              required: ["word", "startMs", "endMs"],
            },
          },
        },
        required: ["id", "speakerId", "startMs", "endMs", "text", "words"],
      },
    },
    scenes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          title: { type: "string" as const },
          startMs: { type: "integer" as const, minimum: 0 },
          endMs: { type: "integer" as const, minimum: 0 },
          description: { type: "string" as const },
          narrativeRole: {
            type: "string" as const,
            enum: ["exposition", "rising_action", "complication", "climax", "resolution", "reflection"],
          },
        },
        required: ["id", "title", "startMs", "endMs", "description", "narrativeRole"],
      },
    },
    themes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
          summary: { type: "string" as const },
          supportingSegmentIds: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["id", "name", "summary", "supportingSegmentIds"],
      },
    },
    claims: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          statement: { type: "string" as const },
          speakerId: { type: "string" as const },
          segmentId: { type: "string" as const },
          confidence: {
            type: "string" as const,
            enum: ["asserted", "implied", "speculative"],
          },
        },
        required: ["id", "statement", "speakerId", "segmentId", "confidence"],
      },
    },
    contradictions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          summary: { type: "string" as const },
          claimAId: { type: "string" as const },
          claimBId: { type: "string" as const },
        },
        required: ["id", "summary", "claimAId", "claimBId"],
      },
    },
    quotations: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          text: { type: "string" as const },
          speakerId: { type: "string" as const },
          segmentId: { type: "string" as const },
          startMs: { type: "integer" as const, minimum: 0 },
          endMs: { type: "integer" as const, minimum: 0 },
          weight: {
            type: "string" as const,
            enum: ["headline", "supporting", "color"],
          },
        },
        required: ["id", "text", "speakerId", "segmentId", "startMs", "endMs", "weight"],
      },
    },
    contentWarnings: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    suggestedSelects: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          reason: { type: "string" as const },
          startMs: { type: "integer" as const, minimum: 0 },
          endMs: { type: "integer" as const, minimum: 0 },
          speakerId: { type: "string" as const },
        },
        required: ["id", "reason", "startMs", "endMs", "speakerId"],
      },
    },
  },
  required: [
    "speakers",
    "segments",
    "scenes",
    "themes",
    "claims",
    "contradictions",
    "quotations",
    "contentWarnings",
    "suggestedSelects",
  ],
};

const ANALYSIS_TOOL = {
  name: "submit_analysis",
  description: "Submit the completed documentary reel analysis as structured JSON. Every field is required — empty arrays for sections with no findings.",
  input_schema: ANALYSIS_TOOL_SCHEMA,
};

const SYSTEM_PROMPT = `You are CUTROOM's documentary analyst. You read raw interview transcripts and return a structured analysis used by a paper-edit workstation.

You MUST call the submit_analysis tool with your complete analysis. Do not output any text outside the tool call.

Rules for the analysis:
- Every quotation, claim, and suggested select MUST reference a real segment id from the segments array.
- All timecodes are integers in milliseconds.
- Be concrete. Avoid generic themes — cite supporting segments by id for every theme.
- A contradiction must point to two real claim ids.
- Return empty arrays (not null/omitted) for sections with no findings.
- Scenes should cover the full transcript runtime without gaps.`;

export class ClaudeRealAdapter implements ClaudeAdapter {
  mode = "live" as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = DEFAULT_ANTHROPIC_MODEL) {
    this.client = new Anthropic({
      apiKey,
      baseURL: "https://api.anthropic.com",
    });
    this.model = model;
  }

  async analyzeReel(args: {
    reelId: string;
    label: string;
    speakers: { id: string; name: string; role: string }[];
    rawTranscript: string;
    runtimeMs: number;
  }): Promise<ReelAnalysis> {
    const userPrompt = [
      `Reel id: ${args.reelId}`,
      `Reel label: ${args.label}`,
      `Approx runtime (ms): ${args.runtimeMs}`,
      `Known speakers: ${JSON.stringify(args.speakers)}`,
      "",
      "Raw transcript:",
      "<<<",
      args.rawTranscript,
      ">>>",
      "",
      "Call submit_analysis with your complete analysis now.",
    ].join("\n");

    let resp: Anthropic.Messages.Message;
    try {
      resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "tool", name: "submit_analysis" },
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (e: unknown) {
      logAnthropicError(e, { reelId: args.reelId, model: this.model });
      throw normalizeAnthropicError(e);
    }

    // ── Strategy 1: Extract from tool_use block (preferred) ──
    const toolBlock = resp.content.find(
      (c): c is Anthropic.ToolUseBlock =>
        c.type === "tool_use" && c.name === "submit_analysis",
    );

    if (toolBlock && toolBlock.input) {
      const parsed = ReelAnalysisSchema.safeParse(toolBlock.input);
      if (parsed.success) return parsed.data satisfies ReelAnalysisInput;
      // Tool input failed validation — log and report field-level errors.
      console.error("[claude] tool_use input failed schema validation", {
        reelId: args.reelId,
        zodErrors: parsed.error.flatten(),
        rawInput: JSON.stringify(toolBlock.input).slice(0, 2000),
      });
      throw new Error(
        `Claude tool input failed schema validation. ` +
        `Field errors: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      );
    }

    // ── Strategy 2: Extract from text content (fallback) ──
    const text = resp.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    if (text) {
      let json: unknown;
      try {
        json = extractJson(text);
      } catch (extractErr) {
        console.error("[claude] JSON extraction failed", {
          reelId: args.reelId,
          extractionError: (extractErr as Error).message,
          rawText: text.slice(0, 2000),
        });
        throw new Error(
          `Claude returned no tool_use block and text did not contain valid JSON. ` +
          `Raw text preview (first 500 chars): ${text.slice(0, 500)}`,
        );
      }

      const parsed = ReelAnalysisSchema.safeParse(json);
      if (parsed.success) return parsed.data satisfies ReelAnalysisInput;

      console.error("[claude] text-extracted JSON failed schema validation", {
        reelId: args.reelId,
        zodErrors: parsed.error.flatten(),
        extractedJson: JSON.stringify(json).slice(0, 2000),
      });
      throw new Error(
        `Claude response failed schema validation. ` +
        `Field errors: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
      );
    }

    // ── Nothing usable — log full response ──
    console.error("[claude] response contained neither tool_use nor text content", {
      reelId: args.reelId,
      contentTypes: resp.content.map((c) => c.type),
      stopReason: resp.stop_reason,
    });
    throw new Error(
      `Claude response contained no usable content. ` +
      `Content types: [${resp.content.map((c) => c.type).join(", ")}]. ` +
      `Stop reason: ${resp.stop_reason ?? "unknown"}.`,
    );
  }
}

// ── JSON extraction ───────────────────────────────────────────────────

function logAnthropicError(e: unknown, context: { reelId: string; model: string }) {
  const err = e as Error & {
    status?: number;
    request_id?: string;
    headers?: { get(name: string): string | null };
    error?: { type?: string; message?: string };
  };
  const requestId = err.request_id ?? err.headers?.get?.("request-id") ?? err.headers?.get?.("anthropic-request-id");
  console.error("[anthropic] messages.create failed", {
    reelId: context.reelId,
    model: context.model,
    status: err.status,
    requestId,
    errorType: err.error?.type,
    message: err.error?.message ?? err.message,
  });
}

function normalizeAnthropicError(e: unknown): Error {
  const err = e as Error & {
    status?: number;
    error?: { type?: string; message?: string };
  };
  const message = err.error?.message ?? err.message ?? "Anthropic Messages API request failed";
  const type = err.error?.type ? ` ${err.error.type}` : "";
  const status = err.status ? `Anthropic ${err.status}${type}` : "Anthropic error";
  return new Error(`${status}: ${message}`);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // Case 1: Pure JSON starting with {
  if (trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }

  // Case 2: ```json fence (with or without language tag, with optional trailing text)
  const fencePatterns = [
    /```(?:json)?\s*\n?([\s\S]*?)```/i,
    /```\s*\n?([\s\S]*?)```/,
  ];
  for (const pat of fencePatterns) {
    const m = pat.exec(trimmed);
    if (m?.[1]) {
      const inner = m[1].trim();
      if (inner.startsWith("{")) {
        try { return JSON.parse(inner); } catch { /* try next */ }
      }
    }
  }

  // Case 3: Single-backtick wrapped
  const bt = /`(\{[\s\S]*?\})`/.exec(trimmed);
  if (bt?.[1]) {
    try { return JSON.parse(bt[1]); } catch { /* fall through */ }
  }

  // Case 4: Find the largest { ... } pair in the text (handles JSON buried in prose)
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(firstBrace, i + 1);
          try { return JSON.parse(candidate); } catch { /* keep looking for another pair */ }
          depth = 1; // resume scanning in case first match wasn't valid JSON
        }
      }
    }
  }

  throw new Error("Claude response did not contain valid JSON.");
}
