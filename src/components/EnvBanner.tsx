import { getAdapters } from "@/adapters";

export function EnvBanner() {
  const { report } = getAdapters();

  if (report.missing.length === 0) return null;

  return (
    <div className="border-b border-vermilion/60 bg-vermilion/5 px-6 py-2.5">
      <div className="mx-auto flex max-w-[1600px] items-start gap-3 font-grotesk text-[10px] uppercase tracking-wider text-ink/80">
        <span className="mt-px shrink-0 text-vermilion">&#x26A0;</span>
        <div>
          <span className="text-ink">Running in {report.mode} mode</span>
          <span className="mx-2 text-ink/40">·</span>
          <span>Missing: {report.missing.join(", ")}</span>
          <span className="mx-2 text-ink/40">·</span>
          <span>Demo data is in use. Set the env vars above for live services.</span>
        </div>
      </div>
    </div>
  );
}
