"use client";
import { useEffect, useState } from "react";
import { API_BASE, COLORS } from "@/lib/constants";

interface SettingsState {
  anthropic_key_source: "env" | "file" | "none";
  anthropic_key_masked: string;
  anthropic_key_set: boolean;
}

const STEPS = [
  {
    n: "1",
    heading: "Create a free Anthropic account",
    body: "Go to console.anthropic.com and sign up. It only takes a minute.",
    action: { label: "Open Anthropic Console →", href: "https://console.anthropic.com" },
  },
  {
    n: "2",
    heading: "Go to API Keys",
    body: 'Inside the Console, click your profile in the top-right and choose "API Keys", or use the direct link below.',
    action: { label: "Go to API Keys →", href: "https://console.anthropic.com/settings/keys" },
  },
  {
    n: "3",
    heading: "Create a new key",
    body: 'Click "Create Key", give it any name (e.g. "Spotify Analytics"), then copy the key — it starts with sk-ant-…',
  },
  {
    n: "4",
    heading: "Paste it below and save",
    body: "Paste the key into the field below and click Save. The key is stored only on your machine and sent directly to Anthropic — never anywhere else.",
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const loadSettings = () =>
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.json())
      .then(d => { setSettings(d); setShowSteps(!d.anthropic_key_set); })
      .catch(() => {});

  useEffect(() => { loadSettings(); }, []);

  const flash = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/anthropic-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        flash("ok", "Key saved successfully.");
        setApiKey("");
        setShowSteps(false);
        await loadSettings();
      } else {
        flash("err", data.error || "Failed to save key.");
      }
    } catch (e: any) {
      flash("err", e.message);
    }
    setSaving(false);
  };

  const deleteKey = async () => {
    if (!confirm("Remove your saved API key?")) return;
    await fetch(`${API_BASE}/api/settings/anthropic-key`, { method: "DELETE" });
    flash("ok", "Key removed.");
    setShowSteps(true);
    await loadSettings();
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Settings</h1>
        <p style={{ color: COLORS.textMuted }} className="text-sm mt-1">
          Configure your analytics platform.
        </p>
      </div>

      {/* ── AI Custom Queries ──────────────────────────────────────────────── */}
      <section style={{ background: COLORS.surface, borderRadius: 12, padding: "24px" }}>
        <div className="flex items-start justify-between mb-1">
          <h2 style={{ color: COLORS.text }} className="text-base font-semibold">
            AI Custom Queries
          </h2>
          {settings?.anthropic_key_set && (
            <span
              style={{
                background: "#14532d", color: "#86efac",
                fontSize: 11, borderRadius: 4, padding: "2px 8px", fontWeight: 600,
              }}
            >
              ✓ Active
            </span>
          )}
        </div>
        <p style={{ color: COLORS.textMuted }} className="text-sm mb-6 leading-relaxed">
          The <strong style={{ color: COLORS.text }}>Custom Query</strong> feature on the Insights page uses Claude — Anthropic's AI — to answer plain-English questions about your listening history.
          To use it, you need a personal API key from Anthropic's website. It's free to start and takes about 2 minutes to set up.
        </p>

        {/* Current key status */}
        {settings?.anthropic_key_set && (
          <div
            style={{
              background: COLORS.surface2, borderRadius: 10,
              padding: "14px 18px", marginBottom: 20,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}
          >
            <div>
              <div style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                API key
              </div>
              <div className="flex items-center gap-3">
                <code style={{ color: COLORS.green, fontSize: 13, letterSpacing: "0.04em" }}>
                  {settings.anthropic_key_masked}
                </code>
                <span
                  style={{
                    background: settings.anthropic_key_source === "env" ? "#1e3a5f" : "#1c3521",
                    color: settings.anthropic_key_source === "env" ? "#93c5fd" : "#86efac",
                    fontSize: 10, borderRadius: 4, padding: "2px 8px", fontWeight: 600,
                  }}
                >
                  {settings.anthropic_key_source === "env" ? "set via environment variable" : "saved in settings"}
                </span>
              </div>
            </div>
            {settings.anthropic_key_source === "file" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSteps(v => !v)}
                  style={{
                    background: COLORS.surface, color: COLORS.textMuted,
                    border: `1px solid ${COLORS.muted}`, borderRadius: 6,
                    padding: "6px 14px", fontSize: 12, cursor: "pointer",
                  }}
                  className="hover:text-white transition-colors"
                >
                  Replace
                </button>
                <button
                  onClick={deleteKey}
                  style={{
                    background: "transparent", border: `1px solid #7f1d1d`,
                    color: "#f87171", borderRadius: 6, padding: "6px 14px",
                    fontSize: 12, cursor: "pointer",
                  }}
                  className="hover:bg-red-950 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}

        {/* How to get a key — step-by-step */}
        {(!settings?.anthropic_key_set || showSteps) && settings?.anthropic_key_source !== "env" && (
          <div style={{ marginBottom: 20 }}>
            {settings?.anthropic_key_set && (
              <div style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 12 }}>
                How to get a new key:
              </div>
            )}
            {!settings?.anthropic_key_set && (
              <div
                style={{
                  background: "#1c1a00", border: "1px solid #713f12",
                  borderRadius: 10, padding: "14px 18px", marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <span style={{ fontSize: 20 }}>🔑</span>
                <div>
                  <div style={{ color: "#fde68a", fontWeight: 600, fontSize: 13 }}>No API key set</div>
                  <div style={{ color: "#a16207", fontSize: 12, marginTop: 2 }}>
                    Follow the steps below to get one — it only takes 2 minutes.
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  style={{
                    background: COLORS.surface2, borderRadius: 10, padding: "14px 18px",
                    display: "flex", gap: 14, alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: COLORS.green, color: "#000",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1,
                    }}
                  >
                    {step.n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {step.heading}
                    </div>
                    <div style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.5 }}>
                      {step.body}
                    </div>
                    {step.action && (
                      <a
                        href={step.action.href}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-block", marginTop: 8,
                          color: COLORS.green, fontSize: 13, fontWeight: 500,
                          textDecoration: "none",
                        }}
                        className="hover:underline"
                      >
                        {step.action.label}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key input */}
        {settings?.anthropic_key_source !== "env" && (
          <div>
            <label
              style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 6, fontWeight: 500 }}
            >
              Paste your API key here
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveKey()}
                  placeholder="sk-ant-…"
                  style={{
                    width: "100%",
                    background: COLORS.surface2,
                    color: COLORS.text,
                    border: `1px solid ${apiKey ? COLORS.green : COLORS.muted}`,
                    borderRadius: 8,
                    padding: "11px 48px 11px 14px",
                    fontSize: 14,
                    fontFamily: "monospace",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    color: COLORS.muted, fontSize: 11, background: "none", border: "none", cursor: "pointer",
                  }}
                  className="hover:text-white"
                >
                  {showKey ? "hide" : "show"}
                </button>
              </div>
              <button
                onClick={saveKey}
                disabled={!apiKey.trim() || saving}
                style={{
                  background: apiKey.trim() && !saving ? COLORS.green : COLORS.surface2,
                  color: apiKey.trim() && !saving ? "#000" : COLORS.muted,
                  borderRadius: 8, padding: "11px 22px", fontWeight: 700,
                  fontSize: 14, border: "none",
                  cursor: apiKey.trim() && !saving ? "pointer" : "default",
                  whiteSpace: "nowrap", transition: "background 0.15s",
                }}
              >
                {saving ? "Saving…" : "Save Key"}
              </button>
            </div>
          </div>
        )}

        {settings?.anthropic_key_source === "env" && (
          <div
            style={{
              background: "#1e3a5f", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#93c5fd",
            }}
          >
            Your key is set via the <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 3 }}>ANTHROPIC_API_KEY</code> environment variable and cannot be changed here.
            To manage it through this page instead, remove that environment variable and restart the backend.
          </div>
        )}

        {/* Feedback toast */}
        {feedback && (
          <div
            style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 13,
              background: feedback.type === "ok" ? "#14532d" : "#7f1d1d",
              color: feedback.type === "ok" ? "#86efac" : "#fca5a5",
            }}
          >
            {feedback.type === "ok" ? "✓ " : "✕ "}{feedback.msg}
          </div>
        )}
      </section>

      {/* ── Data Privacy ──────────────────────────────────────────────────── */}
      <section style={{ background: COLORS.surface, borderRadius: 12, padding: "20px 24px" }}>
        <h2 style={{ color: COLORS.text }} className="text-base font-semibold mb-3">Privacy & Data Storage</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: "🖥", text: "Your Spotify data is processed entirely on your own computer — nothing is uploaded to any cloud or external server." },
            { icon: "🔒", text: "Your API key is saved only in a local config file on this machine and is only ever sent directly to Anthropic when you run a custom query." },
            { icon: "🗑", text: "Processed data is cached locally to speed up reloads. You can safely delete ~/.spotify-analytics/ at any time." },
          ].map(({ icon, text }) => (
            <div key={icon} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, lineHeight: 1.4 }}>{icon}</span>
              <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
