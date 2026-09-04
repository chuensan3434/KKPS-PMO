"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Planning", href: "/planning" },
  { label: "Resources", href: "/resources" },
  { label: "Manday", href: "/manday" },
  { label: "Settings", href: "/settings" },
] as const;

function MenuIcon({ open }: Readonly<{ open: boolean }>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth="2">
      {open ? (
        <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
      ) : (
        <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function NavigationLinks({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {navigationItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              active
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mr-3 size-2 rounded-full ${active ? "bg-blue-600" : "bg-slate-300"}`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="hidden min-h-screen border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <div className="mb-8 px-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">KKPS</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-slate-950">PMO</p>
        </div>
        <NavigationLinks />
      </aside>

      <header className="border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="rounded text-lg font-bold tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
            onClick={() => setMobileOpen(false)}
          >
            KKPS PMO
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="flex size-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>

        {mobileOpen ? (
          <div id="mobile-navigation" className="border-t border-slate-200 px-4 py-3 sm:px-6">
            <NavigationLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        ) : null}
      </header>
    </>
  );
}
