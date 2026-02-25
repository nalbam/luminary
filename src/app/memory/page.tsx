'use client';

import { useState, useEffect } from 'react';
import MemoryNote from '@/components/MemoryNote';

interface Note {
  id: string;
  kind: string;
  content: string;
  tags: string[];
  stability: string;
  confidence: number;
  createdAt: string;
}

const kindFilters = [
  { value: '', label: 'All', icon: '🧠' },
  { value: 'soul', label: 'Soul', icon: '✨' },
  { value: 'log', label: 'Log', icon: '📋' },
  { value: 'summary', label: 'Summary', icon: '📝' },
  { value: 'rule', label: 'Rule', icon: '⚡' },
];

export default function MemoryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState('');
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const url = kindFilter ? `/api/memory?kind=${kindFilter}` : '/api/memory';
      const res = await fetch(url);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, [kindFilter]);

  const runMaintenance = async () => {
    setMaintenanceRunning(true);
    setMaintenanceMsg('');
    try {
      const res = await fetch('/api/maintenance', { method: 'POST' });
      const data = await res.json();
      setMaintenanceMsg(data.message || 'Maintenance complete');
      fetchNotes();
    } catch (e) {
      setMaintenanceMsg(`Error: ${String(e)}`);
    } finally {
      setMaintenanceRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Memory</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} · {kindFilter || 'all kinds'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotes}
            className="px-3 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
          >
            ↺ Refresh
          </button>
          <button
            onClick={runMaintenance}
            disabled={maintenanceRunning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: maintenanceRunning ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.12)',
              color: '#fcd34d',
              border: '1px solid rgba(245,158,11,0.25)',
              opacity: maintenanceRunning ? 0.7 : 1,
            }}
          >
            {maintenanceRunning ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running…
              </>
            ) : '🔧 Maintenance'}
          </button>
        </div>
      </div>

      {/* Maintenance result */}
      {maintenanceMsg && (
        <div
          className="rounded-xl px-4 py-3 mb-5 text-sm flex items-center justify-between"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}
        >
          <span>✓ {maintenanceMsg}</span>
          <button onClick={() => setMaintenanceMsg('')} className="text-xs ml-4 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Kind filter pills */}
      <div className="flex gap-2 mb-6">
        {kindFilters.map(f => (
          <button
            key={f.value}
            onClick={() => setKindFilter(f.value)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
            style={
              kindFilter === f.value
                ? { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            <span>{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {/* Notes */}
      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center" style={{ color: '#475569' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
        </div>
      ) : notes.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <div className="text-4xl mb-3">🧠</div>
          <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>No memory notes yet</p>
          <p className="text-xs mt-1" style={{ color: '#475569' }}>Chat with the assistant to create memory notes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <MemoryNote key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
