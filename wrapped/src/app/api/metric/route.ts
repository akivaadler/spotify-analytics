import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds (Vercel function limit)

const MetricSpec = z.object({
  title: z.string().describe("Short, punchy metric name, max ~5 words"),
  description: z.string().describe("One sentence explaining what the metric measures and how"),
  viz: z.enum(["number", "list", "bars", "line"]),
  unit: z.string().describe("Unit shown next to values, e.g. 'min', 'plays', '%', or '' if none"),
  code: z.string().describe("Body of a JavaScript function (plays, ctx, helpers) that returns the result object"),
});

const SYSTEM = `You write small, fast, correct JavaScript metrics over a person's Spotify listening history.
The user describes a metric in plain English; you return a spec whose \`code\` is the BODY of a function:

  function (plays, ctx, helpers) { <your code> }

## Data
\`plays\`: array of play objects already filtered to the selected period (one calendar year, or all time), sorted by time ascending. Each play:
- ts: number — epoch ms (UTC) when playback ENDED
- ms: number — milliseconds played (0 is possible)
- kind: "track" | "episode" | "audiobook" | "other"
- track, artist, album: string | null (music only)
- uri: string | null — Spotify URI (unique id of the track/episode)
- show, episode: string | null — podcast show / episode title (or audiobook / chapter)
- platform: string — raw device string, e.g. "iOS 17.2 (iPhone15,2)", "Android OS 14 ...", "windows", "web_player ..."
- country: string — 2-letter country code ("ZZ" if unknown)
- reasonStart: "clickrow" | "playbtn" | "trackdone" | "fwdbtn" | "backbtn" | "appload" | "remote" | "unknown" | ...
- reasonEnd: "trackdone" | "fwdbtn" | "backbtn" | "endplay" | "logout" | "unknown" | ...
- shuffle, skipped, offline, incognito: boolean
- year (number), month (1-12), day ("YYYY-MM-DD"), hour (0-23), dow (0=Monday … 6=Sunday), dayIndex (integer days since epoch) — all in the user's LOCAL time zone

\`ctx\`: { scope: number | "all", allPlays: same shape but the FULL history (use for "first time ever", year-over-year, comebacks), years: number[] }

\`helpers\`: QUALIFY_MS (30000), minutes(ms), hours(ms), isMusic(p), isSkip(p), isIntentional(p), isStream(p) (ms >= 30s), trackKey(p), groupBy(arr, fn) -> Map<key, item[]>, sumBy(arr, fn), countBy(arr, fn) -> [{key, count}] desc, topN(arr, n, scoreFn), mean(xs), median(xs).

## Conventions
- A "play"/"stream" counts only when ms >= 30000 (helpers.isStream). Listening TIME uses all ms.
- For music metrics filter with helpers.isMusic. Identify songs by helpers.trackKey(p), albums by album + artist.
- Arrays can hold 200k+ items: stay O(n) or O(n log n). Never nest loops over all plays.
- Pure computation only: no fetch, no DOM, no async, no randomness, no Date.now() (use the data's own timestamps).

## Return value (pick the viz that best fits the question)
- "number": return { value: number | string, caption?: string }   (caption = short context, e.g. "Mar 4 · 212 plays")
- "list":   return { items: [{ label, sub?, value }] }  — ranked rows, max 10; sub = secondary text (e.g. artist)
- "bars":   return { items: [{ label, value }] }        — categorical comparison (≤ 24 bars)
- "line":   return { items: [{ label, value }] }        — ordered series over time (in time order)
Values must be finite numbers (round sensibly). Percentages as 0-100 numbers with unit "%".
Handle empty data gracefully (return { value: "—" } or { items: [] }).
Never include explanations outside the spec fields.`;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    prompt?: string;
    previousCode?: string;
    error?: string;
  } | null;
  const prompt = body?.prompt?.trim();
  if (!prompt) return Response.json({ error: "Describe the metric you want." }, { status: 400 });
  if (prompt.length > 2000) return Response.json({ error: "That description is too long (max 2000 characters)." }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY || req.headers.get("x-anthropic-key") || "";
  if (!apiKey) {
    return Response.json(
      { error: "no_key", message: "This deployment has no ANTHROPIC_API_KEY. Add your own key in the Lab settings." },
      { status: 401 },
    );
  }

  const client = new Anthropic({ apiKey });
  let content = `Metric request: ${prompt}`;
  if (body?.previousCode && body?.error) {
    content += `\n\nYour previous attempt failed.\nCode:\n\`\`\`js\n${body.previousCode.slice(0, 8000)}\n\`\`\`\nError: ${body.error.slice(0, 1000)}\nFix it.`;
  }

  try {
    const msg = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(MetricSpec) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (msg.stop_reason === "refusal") {
      return Response.json({ error: "The model declined this request. Try rephrasing the metric." }, { status: 422 });
    }
    if (!msg.parsed_output) {
      return Response.json({ error: "Couldn't produce a metric for that. Try rephrasing." }, { status: 502 });
    }
    return Response.json(msg.parsed_output);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "no_key", message: "That Anthropic API key was rejected." }, { status: 401 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Rate limited — wait a moment and try again." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Model error (${err.status ?? "?"}): ${err.message}` }, { status: 502 });
    }
    return Response.json({ error: "Unexpected error generating the metric." }, { status: 500 });
  }
}
