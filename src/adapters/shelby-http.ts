import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { NetworkToShelbyRPCBaseUrl, ShelbyNodeClient, type ShelbyNetwork } from "@shelby-protocol/sdk/node";
import type { ArchiveEntry } from "@/domain/types";
import type {
  ShelbyAdapter,
  ShelbyUploadHandle,
  ShelbyUploadProgress,
} from "./types";

interface ShelbyConfig {
  apiKey: string;
  privateKey: string;
  network?: string;
  rpcUrl?: string;
}

interface PendingUpload {
  uploadId: string;
  blobName: string;
  blobPath: string;
  fileName: string;
  projectId: string;
  sizeBytes: number;
  chunks: Uint8Array[];
  bytesUploaded: number;
}

const pendingUploads = new Map<string, PendingUpload>();

export class ShelbyHttpAdapter implements ShelbyAdapter {
  mode = "live" as const;
  private cfg: ShelbyConfig;
  private client: ShelbyNodeClient;
  private signer: Account;
  private network: ShelbyNetwork;

  constructor(cfg: ShelbyConfig) {
    this.cfg = cfg;
    this.network = toShelbyNetwork(cfg.network);
    this.signer = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(normalizePrivateKey(cfg.privateKey)),
    });
    this.client = new ShelbyNodeClient({
      network: this.network,
      apiKey: cfg.apiKey,
      ...(cfg.rpcUrl ? { rpc: { baseUrl: cfg.rpcUrl, apiKey: cfg.apiKey } } : {}),
    });
    console.info("[CUTROOM Shelby] SDK adapter ready", {
      network: this.network,
      rpcBaseUrl: cfg.rpcUrl ?? NetworkToShelbyRPCBaseUrl[this.network],
      account: this.accountAddress,
    });
  }

  async startUpload(args: { fileName: string; sizeBytes: number; kind: ArchiveEntry["kind"]; projectId: string }): Promise<ShelbyUploadHandle> {
    const uploadId = `shelby_${crypto.randomUUID()}`;
    const blobName = makeBlobName(args.projectId, args.kind, args.fileName);
    const blobPath = makeBlobPath(this.accountAddress, blobName);

    pendingUploads.set(uploadId, {
      uploadId,
      blobName,
      blobPath,
      fileName: args.fileName,
      projectId: args.projectId,
      sizeBytes: args.sizeBytes,
      chunks: [],
      bytesUploaded: 0,
    });

    return {
      uploadId,
      blobPath,
      commitment: "pending",
      sizeBytes: args.sizeBytes,
      status: "uploading",
      mode: this.mode,
    };
  }

  async appendChunk(uploadId: string, chunk: Uint8Array, offset: number): Promise<ShelbyUploadProgress> {
    const pending = pendingUploads.get(uploadId);
    if (!pending) {
      return {
        uploadId,
        bytesUploaded: 0,
        totalBytes: 0,
        status: "failed",
        error: "Unknown Shelby upload id.",
      };
    }

    if (offset !== pending.bytesUploaded) {
      return {
        uploadId,
        bytesUploaded: pending.bytesUploaded,
        totalBytes: pending.sizeBytes,
        status: "failed",
        error: `Unexpected Shelby chunk offset ${offset}; expected ${pending.bytesUploaded}.`,
      };
    }

    pending.chunks.push(chunk);
    pending.bytesUploaded += chunk.byteLength;

    return {
      uploadId,
      bytesUploaded: pending.bytesUploaded,
      totalBytes: pending.sizeBytes,
      status: pending.bytesUploaded >= pending.sizeBytes ? "sealed" : "uploading",
    };
  }

  async seal(uploadId: string): Promise<ShelbyUploadHandle> {
    const pending = pendingUploads.get(uploadId);
    if (!pending) throw new Error("Unknown Shelby upload id.");

    const blobData = concatChunks(pending.chunks, pending.bytesUploaded);
    await this.client.batchUpload({
      blobs: [{ blobData, blobName: pending.blobName }],
      signer: this.signer,
      expirationMicros: Date.now() * 1000 + 1000 * 60 * 60 * 24 * 365 * 5 * 1000,
    });
    pendingUploads.delete(uploadId);

    return {
      uploadId,
      blobPath: pending.blobPath,
      commitment: "sdk-managed",
      sizeBytes: pending.sizeBytes,
      status: "sealed",
      mode: this.mode,
    };
  }

  async resolve(blobPath: string): Promise<{ url: string } | null> {
    if (blobPath.startsWith("shelby-mock://")) return null;
    if (blobPath.startsWith("shelby://")) {
      const parsed = parseBlobPath(blobPath);
      if (!parsed) return null;
      return { url: `${this.publicBaseUrl}/v1/blobs/${parsed.account}/${encodePath(parsed.blobName)}` };
    }
    return { url: blobPath };
  }

  async download(blobPath: string, range?: { start: number; end?: number }) {
    const parsed = parseBlobPath(blobPath);
    if (!parsed) return null;
    const blob = await this.client.download({
      account: parsed.account,
      blobName: parsed.blobName,
      ...(range ? { range } : {}),
    });
    return {
      readable: blob.readable,
      contentLength: blob.contentLength,
      contentType: contentTypeForBlob(parsed.blobName),
    };
  }

  async list(_projectId: string): Promise<ArchiveEntry[]> {
    return [];
  }

  private get accountAddress() {
    return this.signer.accountAddress.toString();
  }

  private get publicBaseUrl() {
    const rpcBase = this.cfg.rpcUrl ?? NetworkToShelbyRPCBaseUrl[this.network];
    return (rpcBase ?? "https://api.shelbynet.shelby.xyz/shelby").replace(/\/+$/, "");
  }
}

function toShelbyNetwork(value: string | undefined): ShelbyNetwork {
  if (!value || value.toLowerCase() === "shelbynet") return Network.SHELBYNET;
  if (value.toLowerCase() === "testnet") return Network.TESTNET;
  if (value.toLowerCase() === "local") return Network.LOCAL;
  return Network.SHELBYNET;
}

function normalizePrivateKey(value: string) {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  const withoutPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  if (!/^[a-fA-F0-9]+$/.test(withoutPrefix)) {
    throw new Error("expected a hex private key");
  }
  if (withoutPrefix.length !== 64) {
    throw new Error(`expected 64 hex characters, got ${withoutPrefix.length}`);
  }
  return `0x${withoutPrefix}`;
}

function makeBlobName(projectId: string, kind: ArchiveEntry["kind"], fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload.bin";
  const prefix = `cutroom/${projectId}/${kind}/${crypto.randomUUID()}-`;
  return `${prefix}${safeName.slice(0, Math.max(1, 190 - prefix.length))}`;
}

function makeBlobPath(account: string, blobName: string) {
  return `shelby://${account}/${blobName}`;
}

function parseBlobPath(blobPath: string) {
  const withoutScheme = blobPath.slice("shelby://".length);
  const slash = withoutScheme.indexOf("/");
  if (slash < 0) return null;
  return {
    account: withoutScheme.slice(0, slash),
    blobName: withoutScheme.slice(slash + 1),
  };
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function contentTypeForBlob(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mkv")) return "video/x-matroska";
  return "application/octet-stream";
}

function concatChunks(chunks: Uint8Array[], totalBytes: number) {
  const out = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
