"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { API_BASE, COLORS } from "@/lib/constants";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(r => r.json())
      .then((s: any) => {
        if (s.state !== "ready") router.replace("/");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }} className="flex">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 max-w-screen-2xl">{children}</main>
    </div>
  );
}
