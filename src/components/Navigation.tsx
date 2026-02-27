'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Chat', icon: '💬' },
  { href: '/routines', label: 'Routines', icon: '⚡' },
  { href: '/skills', label: 'Skills', icon: '🔌' },
  { href: '/jobs', label: 'Jobs', icon: '🗓️' },
  { href: '/memory', label: 'Memory', icon: '🧠' },
  { href: '/settings', label: 'Settings', icon: '👤' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-20 border-b"
      style={{ borderColor: 'var(--border-subtle)', background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(20px)' }}
    >
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 0 12px rgba(124,58,237,0.5)' }}
          >
            L
          </div>
          <span className="gradient-text font-bold text-base tracking-tight">luminary</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
          >
            agent
          </span>
        </Link>

        {/* Nav items */}
        <div className="flex items-center gap-1">
          {navItems.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                style={
                  active
                    ? {
                        background: 'rgba(139,92,246,0.18)',
                        color: '#c4b5fd',
                        boxShadow: '0 0 12px rgba(139,92,246,0.2)',
                        border: '1px solid rgba(139,92,246,0.3)',
                      }
                    : {
                        color: '#64748b',
                        border: '1px solid transparent',
                      }
                }
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: '#8b5cf6', bottom: '-6px' }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse inline-block" />
          <span className="hidden sm:inline">online</span>
        </div>
      </div>
    </nav>
  );
}
