"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, COLORS } from "@/lib/constants";
import type { AppStatus } from "@/types";

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if already loaded
  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(r => r.json())
      .then((s: AppStatus) => {
        if (s.state === "ready") router.replace("/overview");
      })
      .catch(() => {});
  }, [router]);

  const startPolling = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const s: AppStatus = await fetch(`${API_BASE}/api/status`).then(r => r.json());
        setStatus(s);
        if (s.state === "ready") {
          clearInterval(pollRef.current!);
          router.replace("/overview");
        }
        if (s.error) {
          clearInterval(pollRef.current!);
          setError(s.error);
          setUploading(false);
        }
      } catch {}
    }, 500);
  }, [router]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".json"));
    setFiles(prev => [...prev, ...dropped]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || "Upload failed");
        setUploading(false);
        return;
      }
      startPolling();
    } catch (e: any) {
      setError(e.message);
      setUploading(false);
    }
  };

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name));

  return (
    <div
      style={{ background: COLORS.bg, minHeight: "100vh" }}
      className="flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div style={{ color: COLORS.green }} className="text-4xl font-bold mb-2">
            Spotify Analytics
          </div>
          <p style={{ color: COLORS.textMuted }} className="text-base">
            Upload your Spotify Extended Streaming History to get started.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && document.getElementById("fileInput")?.click()}
          style={{
            background: dragging ? COLORS.surface2 : COLORS.surface,
            border: `2px dashed ${dragging ? COLORS.green : COLORS.muted}`,
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
            cursor: uploading ? "default" : "pointer",
            transition: "all 0.15s",
          }}
        >
          <input
            id="fileInput"
            type="file"
            accept=".json"
            multiple
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <p style={{ color: COLORS.text }} className="font-medium mb-1">
            Drop your Spotify JSON files here
          </p>
          <p style={{ color: COLORS.textMuted }} className="text-sm">
            or click to browse — select all files at once
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 flex flex-col gap-1">
            {files.map(f => (
              <div
                key={f.name}
                style={{ background: COLORS.surface, borderRadius: 8 }}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span style={{ color: COLORS.textMuted }}>
                  {f.name}
                  <span style={{ color: COLORS.muted }} className="ml-2">
                    ({(f.size / 1_000_000).toFixed(1)} MB)
                  </span>
                </span>
                {!uploading && (
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(f.name); }}
                    style={{ color: COLORS.muted }}
                    className="hover:text-white ml-2"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        {uploading && status && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1" style={{ color: COLORS.textMuted }}>
              <span>Processing…</span>
              <span>{status.progress_pct}%</span>
            </div>
            <div style={{ background: COLORS.surface, borderRadius: 4, height: 6 }}>
              <div
                style={{
                  background: COLORS.green,
                  width: `${status.progress_pct}%`,
                  height: "100%",
                  borderRadius: 4,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{ background: "#3d1e1e", border: "1px solid #a00", borderRadius: 8 }}
            className="mt-4 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {/* Upload button */}
        {!uploading && (
          <button
            onClick={handleUpload}
            disabled={!files.length}
            style={{
              background: files.length ? COLORS.green : COLORS.surface2,
              color: files.length ? "#000" : COLORS.muted,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 15,
              width: "100%",
              padding: "12px 0",
              marginTop: 16,
              cursor: files.length ? "pointer" : "not-allowed",
              border: "none",
              transition: "all 0.15s",
            }}
          >
            {files.length ? `Analyze ${files.length} file${files.length > 1 ? "s" : ""}` : "Select files to begin"}
          </button>
        )}

        {/* How to download */}
        <div className="mt-6">
          <button
            onClick={() => setShowInstructions(i => !i)}
            style={{ color: COLORS.textMuted }}
            className="text-sm hover:text-white transition-colors w-full text-left"
          >
            {showInstructions ? "▾" : "▸"} How to download your Spotify data
          </button>
          {showInstructions && (
            <div
              style={{ background: COLORS.surface, borderRadius: 12, color: COLORS.textMuted }}
              className="mt-3 px-4 py-3 text-sm leading-6"
            >
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to <strong style={{ color: COLORS.text }}>spotify.com/account/privacy</strong></li>
                <li>Scroll to "Download your data"</li>
                <li>Select <strong style={{ color: COLORS.text }}>Extended streaming history</strong></li>
                <li>Click Request — Spotify emails you within ~30 days</li>
                <li>Download the ZIP, unzip it, and upload the <code>Streaming_History_Audio_*.json</code> files here</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
