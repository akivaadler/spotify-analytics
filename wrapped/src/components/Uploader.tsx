"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseFiles } from "@/lib/parse";
import { generateDemo } from "@/lib/demo";
import { useData } from "@/lib/data-context";

export function Uploader({ compact = false }: { compact?: boolean }) {
  const { setLibrary } = useData();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: File[]) {
    if (!files.length) return;
    setError(null);
    setBusy(`Reading ${files.length} file${files.length > 1 ? "s" : ""}…`);
    try {
      const res = await parseFiles(files);
      if (!res.plays.length) {
        setError(
          res.skipped.length
            ? `Couldn't find listening history in: ${res.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}`
            : "No plays found in those files.",
        );
        setBusy(null);
        return;
      }
      setBusy(`Crunching ${res.plays.length.toLocaleString()} plays…`);
      await setLibrary(res.plays, "upload", res.files.map((f) => f.name));
      router.push("/story");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading those files.");
      setBusy(null);
    }
  }

  async function demo() {
    setBusy("Inventing a fake music life…");
    await new Promise((r) => setTimeout(r, 30));
    await setLibrary(generateDemo(), "demo", ["demo"]);
    router.push("/story");
  }

  return (
    <div>
      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle([...e.dataTransfer.files]);
        }}
        onClick={() => !busy && input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        className={`group relative cursor-pointer overflow-hidden rounded-[2rem] border-2 border-dashed p-8 text-center transition sm:p-10 ${
          drag ? "scale-[1.01] border-lime bg-lime/10" : "border-white/20 bg-white/[0.03] hover:border-lime/70"
        }`}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept=".json,.zip,application/json,application/zip"
          className="hidden"
          onChange={(e) => handle([...(e.target.files ?? [])])}
        />
        {busy ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-lime border-t-transparent" />
            <p className="font-display text-2xl font-bold">{busy}</p>
          </div>
        ) : (
          <>
            <p className={`font-display font-extrabold ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>Drop your Spotify files here</p>
            <p className="mx-auto mt-3 max-w-md text-cream/70">
              The <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">my_spotify_data.zip</code> download, or the{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">Streaming_History_Audio_*.json</code> files inside it. Add them all at once.
            </p>
            <span className="mt-6 inline-block rounded-full bg-lime px-6 py-3 font-bold text-ink transition group-hover:scale-105">Choose files</span>
          </>
        )}
      </div>
      {error && <p className="mt-3 rounded-xl bg-red/15 px-4 py-3 text-sm text-red">{error}</p>}
      {!busy && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-cream/60">
          <span>🔒 Processed entirely in your browser. Nothing is uploaded.</span>
          <span className="hidden sm:inline">·</span>
          <button onClick={demo} className="font-semibold text-lime underline-offset-4 hover:underline">
            No files yet? Try demo data →
          </button>
        </div>
      )}
    </div>
  );
}
