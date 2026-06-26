import type { ArchiveEntry } from "@/domain/types";
import type {
  ShelbyAdapter,
  ShelbyUploadHandle,
  ShelbyUploadProgress,
} from "./types";

// MOCK SHELBY adapter. It is essential that this NEVER claims a successful
// real upload. It returns blob paths under "shelby-mock://" so the archive
// ledger can distinguish a simulated record from a sealed one.

interface MockUploadState {
  uploadId: string;
  fileName: string;
  totalBytes: number;
  bytesUploaded: number;
  blobPath: string;
  commitment: string;
  status: "uploading" | "sealed";
}

const uploads = new Map<string, MockUploadState>();

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function fakeCommitment() {
  return `blake3:${Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 6)).join("")}`;
}

export class ShelbyMockAdapter implements ShelbyAdapter {
  mode = "local-mock" as const;

  async startUpload(args: { fileName: string; sizeBytes: number; kind: ArchiveEntry["kind"]; projectId: string }): Promise<ShelbyUploadHandle> {
    const uploadId = genId("up");
    const blobPath = `shelby-mock://cutroom/${args.projectId}/${args.kind}/${uploadId}-${args.fileName}`;
    const state: MockUploadState = {
      uploadId,
      fileName: args.fileName,
      totalBytes: args.sizeBytes,
      bytesUploaded: 0,
      blobPath,
      commitment: fakeCommitment(),
      status: "uploading",
    };
    uploads.set(uploadId, state);
    return {
      uploadId,
      blobPath,
      commitment: state.commitment,
      sizeBytes: args.sizeBytes,
      status: "uploading",
      mode: this.mode,
    };
  }

  async appendChunk(uploadId: string, chunk: Uint8Array, offset: number): Promise<ShelbyUploadProgress> {
    const state = uploads.get(uploadId);
    if (!state) {
      return {
        uploadId,
        bytesUploaded: 0,
        totalBytes: 0,
        status: "failed",
        error: "Unknown upload id (local-mock adapter does not persist between processes)",
      };
    }
    state.bytesUploaded = Math.min(state.totalBytes, offset + chunk.byteLength);
    return {
      uploadId,
      bytesUploaded: state.bytesUploaded,
      totalBytes: state.totalBytes,
      status: "uploading",
    };
  }

  async seal(uploadId: string): Promise<ShelbyUploadHandle> {
    const state = uploads.get(uploadId);
    if (!state) throw new Error("Unknown upload id");
    state.status = "sealed";
    return {
      uploadId: state.uploadId,
      blobPath: state.blobPath,
      commitment: state.commitment,
      sizeBytes: state.totalBytes,
      status: "sealed",
      mode: this.mode,
    };
  }

  async resolve(_blobPath: string): Promise<{ url: string } | null> {
    // In mock mode there is no real URL to resolve to. The player falls back
    // to its CSS-painted frame surrogate when this returns null.
    return null;
  }

  async list(_projectId: string): Promise<ArchiveEntry[]> {
    // The seeded archive entries already live on the project record. This
    // method is here for future Shelby integration; mock mode returns [].
    return [];
  }
}
