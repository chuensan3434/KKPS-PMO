"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigationItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Planning", href: "/planning" },
  { label: "Resources", href: "/resources" },
  { label: "Settings", href: "/settings" },
  { label: "Manday", href: "/manday" },
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
    <nav aria-label="Primary navigation" className="flex flex-col gap-1 lg:flex-row lg:items-center">
      {navigationItems.map((item) => {
        const active = pathname === item.href || (item.href === "/planning" && pathname === "/projects");

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--ink)] text-white"
                : "text-[#596057] hover:bg-[#eef0ea] hover:text-[var(--ink)]"
            }`}
          >
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
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color:rgba(255,255,255,.94)] backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-3 rounded-md" onClick={() => setMobileOpen(false)}>
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-black text-[var(--ink)]">K</span>
            <span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#737a70]">KKPS</span><span className="block text-lg font-extrabold leading-5 tracking-[-0.03em]">PMO</span></span>
          </Link>
          <div className="hidden flex-1 justify-center lg:flex"><NavigationLinks /></div>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
            className="ml-auto flex size-11 items-center justify-center rounded-xl text-[#4d554b] hover:bg-[#eef0ea] lg:hidden"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
        {mobileOpen ? (
          <div id="mobile-navigation" className="border-t border-[var(--border)] px-4 py-3 sm:px-6 lg:hidden">
            <NavigationLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        ) : null}
      </header>
    </>
  );
}
