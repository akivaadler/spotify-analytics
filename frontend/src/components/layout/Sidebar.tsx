"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLORS } from "@/lib/constants";

const NAV = [
  { href: "/overview", label: "Overview", icon: "◉" },
  { href: "/insights", label: "Insights", icon: "✦" },
  { href: "/tracks", label: "Tracks", icon: "♪" },
  { href: "/artists", label: "Artists", icon: "★" },
  { href: "/albums", label: "Albums", icon: "◫" },
  { href: "/temporal", label: "Time Patterns", icon: "⏱" },
  { href: "/sessions", label: "Sessions", icon: "▶" },
  { href: "/podcasts", label: "Podcasts", icon: "🎙" },
  { href: "/devices", label: "Devices", icon: "📱" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      style={{ background: "#000", borderRight: `1px solid ${COLORS.surface2}` }}
      className="w-56 min-h-screen flex flex-col py-6 px-3 flex-shrink-0"
    >
      <div className="mb-8 px-3">
        <div style={{ color: COLORS.green }} className="text-xl font-bold tracking-tight">
          Spotify Analytics
        </div>
        <div style={{ color: COLORS.textMuted }} className="text-xs mt-1">
          Your listening history
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                background: active ? COLORS.surface : "transparent",
                color: active ? COLORS.text : COLORS.textMuted,
                borderRadius: 6,
              }}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors hover:text-white"
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pt-6 flex flex-col gap-3">
        <Link
          href="/settings"
          style={{
            color: pathname === "/settings" ? COLORS.text : COLORS.muted,
            background: pathname === "/settings" ? COLORS.surface : "transparent",
            borderRadius: 6,
          }}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors hover:text-white"
        >
          <span className="text-base w-5 text-center">⚙</span>
          Settings
        </Link>
        <Link
          href="/"
          style={{ color: COLORS.muted }}
          className="text-xs hover:text-white transition-colors px-3"
        >
          ↑ Upload new data
        </Link>
      </div>
    </aside>
  );
}
