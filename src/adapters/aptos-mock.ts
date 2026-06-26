import type { AptosAdapter, AptosWalletSession } from "./types";

// Mock Aptos wallet — gives the UI a credible address so the archive ledger
// and ownership badges have something to display without ever asserting that
// a real on-chain identity has been established.

let session: AptosWalletSession | null = null;

function randomHex(len: number) {
  let s = "";
  while (s.length < len) s += Math.random().toString(16).slice(2);
  return s.slice(0, len);
}

export class AptosMockAdapter implements AptosAdapter {
  mode = "local-mock" as const;

  async connect(): Promise<AptosWalletSession> {
    session = {
      address: `0x${randomHex(64)}`,
      publicKey: `0x${randomHex(64)}`,
      network: "local-mock",
      connectedAt: new Date().toISOString(),
      mode: "local-mock",
    };
    return session;
  }

  async current(): Promise<AptosWalletSession | null> {
    return session;
  }

  async disconnect(): Promise<void> {
    session = null;
  }
}
