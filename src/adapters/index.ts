import { AptosMockAdapter } from "./aptos-mock";
import {
  ClaudeMockAdapter,
  ClaudeRealAdapter,
  ClaudeUnavailableAdapter,
  DEFAULT_ANTHROPIC_MODEL,
} from "./claude";
import { MemoryPersistenceAdapter } from "./persistence-memory";
import { PrismaPersistenceAdapter } from "./persistence-prisma";
import { ShelbyHttpAdapter } from "./shelby-http";
import { ShelbyMockAdapter } from "./shelby-mock";
import { makeTranscriptionAdapter } from "./transcription";
import type { AdapterBundle, ModeReport, PersistenceAdapter, ShelbyAdapter } from "./types";

// Single composition root for the adapter bundle. Real bindings are wired
// here, behind environment-variable gates, so the app can boot without any
// credentials present.
//
// IMPORTANT: a mock adapter must NEVER claim a successful real upload. The
// mode report is surfaced (discreetly) in the archive ledger so the operator
// can tell what's real and what isn't.

let cached: AdapterBundle | null = null;

export function getAdapters(): AdapterBundle {
  if (cached) return cached;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const useMockAi = process.env.USE_MOCK_AI === "true";
  const shelbyKey = process.env.SHELBY_API_KEY;
  const shelbyPrivateKey = process.env.SHELBY_PRIVATE_KEY ?? process.env.APTOS_PRIVATE_KEY;
  const shelbyUrl = process.env.SHELBY_RPC_URL;
  const databaseUrl = process.env.DATABASE_URL;

  const aptos = new AptosMockAdapter();
  const transcription = makeTranscriptionAdapter();

  const shelbySetupErrors: string[] = [];
  let shelby: ShelbyAdapter = new ShelbyMockAdapter();
  if (shelbyKey && shelbyPrivateKey) {
    try {
      shelby = new ShelbyHttpAdapter({
        apiKey: shelbyKey,
        privateKey: shelbyPrivateKey,
        network: process.env.SHELBY_NETWORK,
        rpcUrl: shelbyUrl,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      shelbySetupErrors.push(`Shelby private key is invalid: ${message}`);
      console.error("[CUTROOM adapters] Shelby disabled; invalid private key.", {
        error: message,
      });
    }
  }

  const claude = useMockAi
    ? new ClaudeMockAdapter()
    : anthropicKey
      ? new ClaudeRealAdapter(anthropicKey, process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL)
      : new ClaudeUnavailableAdapter();

  const persistence: PersistenceAdapter = databaseUrl
    ? new PrismaPersistenceAdapter()
    : new MemoryPersistenceAdapter();

  const liveCount = [shelby, claude, aptos, persistence, transcription].filter(
    (a) => a.mode === "live",
  ).length;
  const allMock = liveCount === 0;

  const missing: string[] = [];
  if (!anthropicKey && !useMockAi) missing.push("ANTHROPIC_API_KEY (Claude analysis)");
  if (!shelbyKey || !shelbyPrivateKey) missing.push("SHELBY_API_KEY / SHELBY_PRIVATE_KEY (Shelby storage)");
  missing.push(...shelbySetupErrors);
  if (!databaseUrl) missing.push("DATABASE_URL (persistence)");
  if (!process.env.TRANSCRIPTION_API_KEY) missing.push("TRANSCRIPTION_API_KEY (transcription)");

  const report: ModeReport = {
    mode: allMock ? "local-mock" : "live",
    shelby: shelby.mode,
    claude: claude.mode,
    aptos: aptos.mode,
    persistence: persistence.mode,
    transcription: transcription.mode,
    transcriptionProvider: transcription.provider,
    missing,
    note: allMock
      ? "All adapters running in local-mock mode. No external services are contacted."
      : `Mixed mode — live: ${(
          [
            [shelby.mode, "Shelby"],
            [claude.mode, "Claude"],
            [aptos.mode, "Aptos"],
            [persistence.mode, "Persistence"],
            [transcription.mode, `Transcription (${transcription.provider})`],
          ] as [string, string][]
        )
          .filter(([m]) => m === "live")
          .map(([, label]) => label)
          .join(", ")}. The rest run in local-mock.`,
  };

  cached = { shelby, claude, aptos, persistence, transcription, report };
  return cached;
}
