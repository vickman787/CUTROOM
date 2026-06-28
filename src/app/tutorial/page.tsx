import Link from "next/link";
import { ReelHeader } from "@/components/ReelHeader";

const workflow = [
  {
    number: "01",
    title: "Create a project",
    body: "Open the Project Shelf and create a canister for your documentary. The canister keeps its reels, analysis, selects, edit, treatment, and archive together.",
  },
  {
    number: "02",
    title: "Upload in the Screening Room",
    body: "Open the first reel and upload your source video. The Screening Room is where you watch the complete recording and return whenever you need to find another moment.",
  },
  {
    number: "03",
    title: "Transcribe and analyze",
    body: "Run transcription to turn speech into timed text, then run analysis to identify speakers, scenes, themes, claims, contradictions, and notable quotations.",
  },
  {
    number: "04",
    title: "Mark a select",
    body: "Move the playhead to the beginning of a useful moment and set IN. Move to its ending and set OUT, then save the select to preserve that exact section.",
  },
  {
    number: "05",
    title: "Review the Contact Sheet",
    body: "Use the Contact Sheet to scan the reel as a visual overview. It helps you move through long recordings and relocate scenes quickly.",
  },
  {
    number: "06",
    title: "Organize the Selects Bench",
    body: "The Selects Bench gathers your saved moments from every reel. Review the clips, compare them, and decide which ones belong in the story.",
  },
  {
    number: "07",
    title: "Build the Paper Edit",
    body: "Move selects into Acts I, II, and III, arrange their order, and play the sequence to test how the documentary flows before opening a traditional editor.",
  },
  {
    number: "08",
    title: "Write and archive",
    body: "Develop the written Treatment from the emerging structure. Use the Archive Ledger to reopen and manage source footage stored for the project.",
  },
];

export default function TutorialPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <ReelHeader
        trail={[
          { href: "/", label: "Opening" },
          { href: "/tutorial", label: "Tutorial", current: true },
        ]}
      />

      <section className="border-b border-ink/50">
        <div className="mx-auto grid max-w-[1600px] gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.5fr)] lg:px-10">
          <div>
            <p className="font-grotesk text-[11px] uppercase tracking-wider text-ink/65">
              CUTROOM field guide / Start here
            </p>
            <h1 className="mt-3 max-w-[850px] font-serif text-[clamp(44px,6vw,88px)] leading-[0.95]">
              From raw footage to a paper edit.
            </h1>
          </div>
          <div className="self-end border-l border-vermilion pl-5">
            <p className="font-serif text-[17px] leading-relaxed text-ink/80">
              Follow the video, then use the eight-step reference below while working on your first documentary.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-ink/50 bg-ink py-8 text-paper">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="mb-4 flex items-end justify-between gap-5">
            <div>
              <p className="font-grotesk text-[10px] uppercase tracking-wider text-paper/60">Video guide</p>
              <h2 className="mt-1 font-serif text-[28px]">CUTROOM walkthrough</h2>
            </div>
            <a
              href="https://www.youtube.com/watch?v=MUe7wmE2KGA"
              target="_blank"
              rel="noreferrer"
              className="font-grotesk text-[10px] uppercase tracking-wider text-paper/70 underline underline-offset-4 hover:text-paper"
            >
              Open on YouTube
            </a>
          </div>
          <div className="aspect-video w-full overflow-hidden border border-paper/30 bg-black">
            <iframe
              className="h-full w-full"
              src="https://www.youtube-nocookie.com/embed/MUe7wmE2KGA"
              title="CUTROOM video tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 py-12 lg:px-10">
        <div className="mb-8 border-b border-ink/40 pb-5">
          <p className="font-grotesk text-[10px] uppercase tracking-wider text-ink/60">Working order</p>
          <h2 className="mt-1 font-serif text-[38px]">The CUTROOM workflow</h2>
        </div>

        <ol className="grid gap-x-12 md:grid-cols-2">
          {workflow.map((step) => (
            <li key={step.number} className="grid grid-cols-[52px_1fr] gap-4 border-b border-ink/25 py-7">
              <span className="font-grotesk text-[13px] tracking-wider text-vermilion">{step.number}</span>
              <div>
                <h3 className="font-grotesk text-[15px] uppercase tracking-wider">{step.title}</h3>
                <p className="mt-2 max-w-[560px] font-serif text-[16px] leading-relaxed text-ink/75">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-ink pt-6">
          <p className="max-w-[650px] font-serif text-[17px] italic text-ink/75">
            Your source reel remains available, so one upload can produce as many selects as the story needs.
          </p>
          <Link
            href="/projects"
            className="border border-ink bg-ink px-6 py-3 font-grotesk text-[12px] uppercase tracking-wider text-paper hover:border-vermilion hover:bg-vermilion"
          >
            Open project shelf
          </Link>
        </div>
      </section>
    </main>
  );
}
