import net from "node:net";
import tls from "node:tls";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobState {
  id: string;
  kind: "upload" | "transcribe" | "analyze";
  status: JobStatus;
  projectId?: string;
  reelId?: string;
  message?: string;
  result?: unknown;
  error?: string;
  updatedAt: string;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

export async function setJobState(state: Omit<JobState, "updatedAt">): Promise<void> {
  const updated: JobState = { ...state, updatedAt: new Date().toISOString() };
  try {
    await redisSet(`cutroom:job:${state.id}`, JSON.stringify(updated), DEFAULT_TTL_SECONDS);
  } catch (e) {
    console.error("[redis] failed to write job state", {
      id: state.id,
      kind: state.kind,
      status: state.status,
      message: (e as Error).message,
    });
  }
}

export async function getJobState(id: string): Promise<JobState | null> {
  const raw = await redisGet(`cutroom:job:${id}`);
  if (!raw) return null;
  return JSON.parse(raw) as JobState;
}

export function redisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!process.env.REDIS_URL) return;
  await redisCommand(["SET", key, value, "EX", String(ttlSeconds)]);
}

async function redisGet(key: string): Promise<string | null> {
  if (!process.env.REDIS_URL) return null;
  const result = await redisCommand(["GET", key]);
  return typeof result === "string" ? result : null;
}

async function redisCommand(args: string[]): Promise<unknown> {
  const url = new URL(process.env.REDIS_URL ?? "");
  const port = Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379));
  const socket = url.protocol === "rediss:"
    ? tls.connect({ host: url.hostname, port, servername: url.hostname })
    : net.connect({ host: url.hostname, port });

  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    let expectedResponses = 1;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Redis command timed out"));
    }, 5000);

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      try {
        const response = Buffer.concat(chunks).toString("utf8");
        const parsed = parseResp(response, expectedResponses);
        if (!parsed.complete) return;
        clearTimeout(timeout);
        socket.end();
        if (parsed.error) reject(new Error(parsed.error));
        else resolve(parsed.value);
      } catch (err) {
        clearTimeout(timeout);
        socket.destroy();
        reject(err);
      }
    });
    socket.on("connect", () => {
      const commands: string[][] = [];
      if (url.password) {
        commands.push(url.username
          ? ["AUTH", decodeURIComponent(url.username), decodeURIComponent(url.password)]
          : ["AUTH", decodeURIComponent(url.password)]);
      }
      commands.push(args);
      expectedResponses = commands.length;
      socket.write(commands.map(encodeCommand).join(""));
    });
  });
}

function encodeCommand(args: string[]): string {
  return `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join("")}`;
}

function parseResp(response: string, expectedResponses: number): { complete: boolean; value?: unknown; error?: string } {
  const values: unknown[] = [];
  let offset = 0;
  while (offset < response.length && values.length < expectedResponses) {
    const parsed = parseOneResp(response, offset);
    if (!parsed.complete) return { complete: false };
    if (parsed.error) return { complete: true, error: parsed.error };
    values.push(parsed.value);
    offset = parsed.nextOffset;
  }
  if (values.length < expectedResponses) return { complete: false };
  return { complete: true, value: values[values.length - 1] };
}

function parseOneResp(
  response: string,
  offset: number,
): { complete: boolean; value?: unknown; error?: string; nextOffset: number } {
  const first = response[offset];
  if (!first) return { complete: false, nextOffset: offset };
  const lineEnd = response.indexOf("\r\n", offset);
  if (lineEnd < 0) return { complete: false, nextOffset: offset };
  const line = response.slice(offset + 1, lineEnd);
  const nextLineOffset = lineEnd + 2;

  if (first === "+") return { complete: true, value: line, nextOffset: nextLineOffset };
  if (first === "-") return { complete: true, error: line, nextOffset: nextLineOffset };
  if (first === ":") return { complete: true, value: Number(line), nextOffset: nextLineOffset };
  if (first === "$") {
    const len = Number(line);
    if (len === -1) return { complete: true, value: null, nextOffset: nextLineOffset };
    const start = nextLineOffset;
    const end = start + len;
    if (response.length < end + 2) return { complete: false, nextOffset: offset };
    return { complete: true, value: response.slice(start, end), nextOffset: end + 2 };
  }
  throw new Error(`Unsupported Redis response: ${first}`);
}
