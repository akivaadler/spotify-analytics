"use client";
import { useEffect, useState } from "react";
import { API_BASE, COLORS } from "@/lib/constants";

interface SettingsState {
  anthropic_key_source: "env" | "file" | "none";
  anthropic_key_masked: string;
  anthropic_key_set: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const loadSettings = () =>
    fetch(`${API_BASE}/api/settings`)
      .then(r => r.json())
      .then(setSettings)
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
        flash("ok", "API key saved.");
        setApiKey("");
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
    if (!confirm("Remove saved API key?")) return;
    await fetch(`${API_BASE}/api/settings/anthropic-key`, { method: "DELETE" });
    flash("ok", "Key removed.");
    await loadSettings();
  };

  return (
    <div className="flex flex-col gap-8 max-w-xl">
      <div>
        <h1 style={{ color: COLORS.text }} className="text-2xl font-bold">Settings</h1>
        <p style={{ color: COLORS.textMuted }} className="text-sm mt-1">
          Configure your analytics platform preferences.
        </p>
      </div>

      {/* Anthropic API Key */}
      <section style={{ background: COLORS.surface, borderRadius: 12, padding: "24px" }}>
        <h2 style={{ color: COLORS.text }} className="text-base font-semibold mb-1">
          Anthropic API Key
        </h2>
        <p style={{ color: COLORS.textMuted }} className="text-xs mb-5 leading-relaxed">
          Required for the <strong style={{ color: COLORS.text }}>Custom Query</strong> feature on the Insights page.
          Your key is stored locally at{" "}
          <code style={{ background: COLORS.surface2, padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>
            ~/.spotify-analytics/config.json
          </code>{" "}
          and never sent anywhere except directly to Anthropic.
          If you set <code style={{ background: COLORS.surface2, padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>ANTHROPIC_API_KEY</code>{" "}
          as an environment variable, that takes priority over this saved key.
        </p>

        {/* Current status */}
        {settings && (
          <div
            style={{
              background: COLORS.surface2,
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Current key
              </div>
              {settings.anthropic_key_set ? (
                <div className="flex items-center gap-3">
                  <code style={{ color: COLORS.green, fontSize: 13 }}>
                    {settings.anthropic_key_masked}
                  </code>
                  <span
                    style={{
                      background: settings.anthropic_key_source === "env" ? "#1e3a5f" : "#14532d",
                      color: settings.anthropic_key_source === "env" ? "#93c5fd" : "#86efac",
                      fontSize: 10, borderRadius: 4, padding: "2px 7px", fontWeight: 600,
                    }}
                  >
                    {settings.anthropic_key_source === "env" ? "from env var" : "from settings"}
                  </span>
                </div>
              ) : (
                <span style={{ color: COLORS.muted, fontSize: 13 }}>No key set</span>
              )}
            </div>

            {settings.anthropic_key_set && settings.anthropic_key_source === "file" && (
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
            )}
          </div>
        )}

        {/* Save new key */}
        {settings?.anthropic_key_source !== "env" && (
          <div>
            <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 6 }}>
              {settings?.anthropic_key_source === "file" ? "Replace key" : "Enter API key"}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveKey()}
                  placeholder="sk-ant-api03-…"
                  style={{
                    width: "100%",
                    background: COLORS.surface2,
                    color: COLORS.text,
                    border: `1px solid ${COLORS.muted}`,
                    borderRadius: 8,
                    padding: "10px 40px 10px 14px",
                    fontSize: 14,
                    fontFamily: "monospace",
                  }}
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    color: COLORS.muted, fontSize: 12, background: "none", border: "none", cursor: "pointer",
                  }}
                  tabIndex={-1}
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
                  borderRadius: 8, padding: "10px 20px", fontWeight: 600,
                  fontSize: 14, border: "none", cursor: apiKey.trim() && !saving ? "pointer" : "default",
                  whiteSpace: "nowrap",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            <p style={{ color: COLORS.muted, fontSize: 11, marginTop: 8 }}>
              Get your key at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                style={{ color: COLORS.green }}
              >
                console.anthropic.com
              </a>
            </p>
          </div>
        )}

        {settings?.anthropic_key_source === "env" && (
          <p style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>
            Key is provided via the <code style={{ background: COLORS.surface2, padding: "1px 5px", borderRadius: 3 }}>ANTHROPIC_API_KEY</code> environment variable.
            To override it here, unset that variable and restart the backend.
          </p>
        )}

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              background: feedback.type === "ok" ? "#14532d" : "#7f1d1d",
              color: feedback.type === "ok" ? "#86efac" : "#fca5a5",
            }}
          >
            {feedback.msg}
          </div>
        )}
      </section>

      {/* Storage note */}
      <section style={{ background: COLORS.surface, borderRadius: 12, padding: "20px 24px" }}>
        <h2 style={{ color: COLORS.text }} className="text-base font-semibold mb-2">
          Data Storage
        </h2>
        <p style={{ color: COLORS.textMuted }} className="text-sm leading-relaxed">
          All your Spotify data is processed locally and held in memory while the backend is running.
          Nothing is written to disk except cached processed files in{" "}
          <code style={{ background: COLORS.surface2, padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>
            ~/.spotify-analytics/cache/
          </code>.
          Your data is never uploaded to any external server.
        </p>
      </section>
    </div>
  );
}
