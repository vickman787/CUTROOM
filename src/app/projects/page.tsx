import Link from "next/link";
import { ReelHeader } from "@/components/ReelHeader";
import { loadProjects } from "@/lib/server-projects";
import { formatDuration } from "@/lib/time";

export default async function ProjectsPage() {
  const projects = await loadProjects();

  return (
    <main className="min-h-screen text-ink">
      <ReelHeader
        trail={[
          { href: "/", label: "Opening" },
          { href: "/projects", label: "Project Shelf", current: true },
        ]}
      />

      <section className="mx-auto max-w-[1600px] px-8 py-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/70">SHELF / A</p>
            <h1 className="mt-1 font-serif text-[44px] leading-none tracking-tight">In production</h1>
          </div>
          <p className="max-w-[420px] font-serif text-[14px] leading-snug text-ink/75">
            Each canister holds a project. Open one to enter the screening room.
          </p>
        </div>

        <Shelf>
          {projects.map((p) => (
            <Canister
              key={p.id}
              href={`/projects/${p.slug}/screening/${p.reels[0]?.id ?? ""}`}
              deleteHref={`/projects/${p.slug}/delete`}
              title={p.title}
              subtitle={p.subtitle}
              reels={p.reels.length}
              runtime={formatDuration(p.reels.reduce((a, r) => a + r.durationMs, 0))}
              palette={p.reels[0]?.posterPalette ?? ["#241a13", "#7a3b1a", "#d6a85b"]}
              shotAround={p.shotAround}
            />
          ))}
          {Array.from({ length: Math.max(0, 5 - projects.length) }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} number={projects.length + i + 1} />
          ))}
        </Shelf>

        <p className="mt-10 max-w-[640px] font-serif text-[13px] italic text-ink/70">
          New projects begin with a fresh canister. CUTROOM never moves a canister off the shelf — closed projects move down to Shelf B, where they wait.
        </p>
        <NewProjectForm />
      </section>
    </main>
  );
}

function NewProjectForm() {
  return (
    <form action="/projects/create" method="post" className="mt-8 max-w-[760px] border-y border-ink/40 py-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Project title</span>
          <input
            name="title"
            required
            placeholder="Untitled documentary"
            className="mt-1 w-full border border-ink bg-paper px-3 py-2 font-serif text-[16px] outline-none focus:border-vermilion"
          />
        </label>
        <label className="md:col-span-2">
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Logline</span>
          <textarea
            name="logline"
            rows={3}
            placeholder="A one-sentence promise for the film."
            className="mt-1 w-full resize-none border border-ink bg-paper px-3 py-2 font-serif text-[14px] outline-none focus:border-vermilion"
          />
        </label>
        <label>
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Director</span>
          <input
            name="director"
            className="mt-1 w-full border border-ink/70 bg-paper px-3 py-2 font-serif text-[14px] outline-none focus:border-vermilion"
          />
        </label>
        <label>
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Production company</span>
          <input
            name="productionCompany"
            className="mt-1 w-full border border-ink/70 bg-paper px-3 py-2 font-serif text-[14px] outline-none focus:border-vermilion"
          />
        </label>
        <label className="md:col-span-2">
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-ink/65">Shot around</span>
          <input
            name="shotAround"
            placeholder="Location / date range"
            className="mt-1 w-full border border-ink/70 bg-paper px-3 py-2 font-serif text-[14px] outline-none focus:border-vermilion"
          />
        </label>
      </div>
      <button
        type="submit"
        className="mt-4 border border-ink bg-ink px-4 py-2 font-grotesk text-[11px] uppercase tracking-wider text-paper hover:border-vermilion hover:bg-vermilion"
      >
        Create project
      </button>
    </form>
  );
}

function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="relative flex items-end gap-9 overflow-x-auto pb-8 pl-1 pr-1 pt-12">
        {children}
      </div>
      <div
        aria-hidden
        className="relative -mt-2 h-[18px] border-y border-ink/60"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0) 35%, rgba(0,0,0,0.18)), repeating-linear-gradient(90deg, var(--paper-deep) 0 22px, var(--paper-edge) 22px 23px)",
        }}
      />
      <div aria-hidden className="h-[8px] bg-gradient-to-b from-black/15 to-transparent" />
    </div>
  );
}

function Canister(props: {
  href: string;
  deleteHref: string;
  title: string;
  subtitle: string;
  reels: number;
  runtime: string;
  palette: [string, string, string];
  shotAround: string;
}) {
  return (
    <div className="relative w-[300px] shrink-0">
    <Link
      href={props.href}
      className="group relative block"
      aria-label={`Open ${props.title}`}
    >
      <div className="absolute -top-2 left-1/2 z-30 -translate-x-1/2 -rotate-[1.2deg] tape tape-rip px-6 py-2 text-[11px]">
        REEL CAN
      </div>

      <div className="relative aspect-square">
        <div
          className="absolute inset-0 rounded-full border border-ink/80"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${props.palette[2]}55, transparent 60%), radial-gradient(circle at 70% 70%, ${props.palette[1]}66, transparent 65%), ${props.palette[0]}`,
            boxShadow:
              "inset 0 0 0 6px rgba(0,0,0,0.25), inset 0 0 0 7px var(--paper-warm), inset 0 0 0 8px rgba(0,0,0,0.3), 0 8px 0 rgba(0,0,0,0.15), 0 12px 18px rgba(0,0,0,0.18)",
          }}
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/40"
          style={{
            background: `radial-gradient(circle, ${props.palette[1]}, ${props.palette[0]} 65%)`,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        />
        <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-[18%]">
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i * 60 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * 8}
                y1={50 + Math.sin(a) * 8}
                x2={50 + Math.cos(a) * 44}
                y2={50 + Math.sin(a) * 44}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth="2"
              />
            );
          })}
          <circle cx="50" cy="50" r="6" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.6" />
        </svg>
        <div className="absolute bottom-[12%] left-1/2 z-10 w-[78%] -translate-x-1/2 text-center">
          <div className="border-y border-ink/40 bg-ink/85 px-3 py-1.5 font-grotesk text-[11px] uppercase tracking-wider text-paper">
            {props.subtitle}
          </div>
        </div>
        <div
          aria-hidden
          className="absolute -left-3 top-[58%] h-[36px] w-[120px] -rotate-[18deg] sprocket-strip"
        />
      </div>

      <div className="mt-5 border-t border-ink/30 pt-3 font-grotesk text-[11px] uppercase tracking-wider text-ink/85">
        <div className="text-[13px] tracking-[0.18em] text-ink">{props.title}</div>
        <div className="mt-1 flex justify-between text-ink/70">
          <span>{props.reels} reels</span>
          <span>{props.runtime}</span>
        </div>
        <div className="mt-1 text-ink/60">{props.shotAround}</div>
      </div>

      <div className="mt-3 inline-block border border-ink bg-paper px-3 py-1 font-grotesk text-[10px] uppercase tracking-wider opacity-80 transition-colors group-hover:bg-ink group-hover:text-paper">
        Open canister →
      </div>
    </Link>
    <form action={props.deleteHref} method="post" className="mt-2">
      <button
        type="submit"
        className="border border-vermilion/70 bg-paper px-3 py-1 font-grotesk text-[10px] uppercase tracking-wider text-vermilion hover:bg-vermilion hover:text-paper"
      >
        Delete canister
      </button>
    </form>
    </div>
  );
}

function EmptySlot({ number }: { number: number }) {
  return (
    <div className="relative w-[300px] shrink-0 opacity-55">
      <div className="absolute -top-2 left-1/2 z-30 -translate-x-1/2 -rotate-[0.6deg] tape tape-rip px-6 py-2 text-[11px]">
        SLOT · {number.toString().padStart(2, "0")}
      </div>
      <div
        className="aspect-square rounded-full border border-dashed border-ink/40"
        style={{ background: "var(--paper-deep)" }}
      />
      <div className="mt-5 border-t border-ink/20 pt-3 font-grotesk text-[11px] uppercase tracking-wider text-ink/55">
        Empty
      </div>
    </div>
  );
}
