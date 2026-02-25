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

export default function MemoryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState('');
  const [maintenanceRunning, setMaintenanceRunning] = useState(false);

  const fetchNotes = async () => {
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
    try {
      const res = await fetch('/api/maintenance', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Maintenance complete');
      fetchNotes();
    } catch (e) {
      alert(`Error: ${String(e)}`);
    } finally {
      setMaintenanceRunning(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Memory</h1>
        <div className="flex gap-2">
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value)}
            className="bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All kinds</option>
            <option value="log">Log</option>
            <option value="summary">Summary</option>
            <option value="rule">Rule</option>
          </select>
          <button
            onClick={runMaintenance}
            disabled={maintenanceRunning}
            className="bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
          >
            {maintenanceRunning ? 'Running...' : 'Run Maintenance'}
          </button>
          <button
            onClick={fetchNotes}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading memory...</p>
      ) : notes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No memory notes yet</p>
          <p className="text-gray-600 text-sm mt-2">Chat with the assistant to create memory notes</p>
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
