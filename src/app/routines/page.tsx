'use client';

import { useState, useEffect } from 'react';
import SkillCard from '@/components/SkillCard';

interface Routine {
  id: string;
  name: string;
  goal: string;
  trigger_type: string;
  tools?: string;
  enabled: number;
  created_at: string;
}

const AVAILABLE_TOOLS = ['summarize', 'remember', 'list_memory', 'web_search', 'run_bash', 'fetch_url'];

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.2s',
} as const;

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    triggerType: 'manual',
    tools: [] as string[],
  });

  const fetchRoutines = async () => {
    try {
      const res = await fetch('/api/routines');
      const data = await res.json();
      setRoutines(data.routines || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoutines(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRoutine ? `/api/routines/${editingRoutine.id}` : '/api/routines';
      const method = editingRoutine ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, goal: form.goal, triggerType: form.triggerType, tools: form.tools }),
      });
      setShowForm(false);
      setEditingRoutine(null);
      setForm({ name: '', goal: '', triggerType: 'manual', tools: [] });
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this routine?')) return;
    await fetch(`/api/routines/${id}`, { method: 'DELETE' });
    fetchRoutines();
  };

  const handleRun = async (routineId: string) => {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId, triggerType: 'manual', runNow: true }),
    });
    alert('Job enqueued! Check the Jobs page for status.');
  };

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine);
    let parsedTools: string[] = [];
    try { parsedTools = JSON.parse(routine.tools || '[]'); } catch { parsedTools = []; }
    setForm({ name: routine.name, goal: routine.goal, triggerType: routine.trigger_type, tools: parsedTools });
    setShowForm(true);
  };

  const toggleTool = (tool: string) => {
    setForm(prev => ({
      ...prev,
      tools: prev.tools.includes(tool) ? prev.tools.filter(t => t !== tool) : [...prev.tools, tool],
    }));
  };

  const openCreate = () => {
    setEditingRoutine(null);
    setForm({ name: '', goal: '', triggerType: 'manual', tools: [] });
    setShowForm(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Routines</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            Multi-step task recipes — LLM plans and executes each step
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#f1f5f9', boxShadow: '0 0 20px rgba(109,40,217,0.35)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 28px rgba(109,40,217,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(109,40,217,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <span className="text-base leading-none">+</span>
          New Routine
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: '#0d0d18', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 60px rgba(109,40,217,0.25)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>
                {editingRoutine ? 'Edit Routine' : 'New Routine'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingRoutine(null); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Routine Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g., Daily Summary"
                  required
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Goal</label>
                <textarea
                  value={form.goal}
                  onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="What should this routine accomplish?"
                  rows={3}
                  required
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Trigger Type</label>
                <select
                  value={form.triggerType}
                  onChange={e => setForm(p => ({ ...p, triggerType: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <option value="manual">Manual</option>
                  <option value="schedule">Schedule</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>Allowed Tools <span style={{ color: '#475569' }}>(empty = all tools)</span></label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TOOLS.map(tool => (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className="text-xs px-3 py-1.5 rounded-lg font-mono transition-all duration-150"
                      style={
                        form.tools.includes(tool)
                          ? { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }
                      }
                    >
                      {tool}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#f1f5f9', boxShadow: '0 0 18px rgba(109,40,217,0.3)' }}
                >
                  {editingRoutine ? 'Update Routine' : 'Create Routine'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingRoutine(null); }}
                  className="px-5 py-2.5 rounded-xl text-sm transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center" style={{ color: '#475569' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
        </div>
      ) : routines.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <div className="text-4xl mb-3">⚡</div>
          <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>No routines yet</p>
          <p className="text-xs mt-1 mb-6" style={{ color: '#475569' }}>Create a routine to automate multi-step tasks</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            + Create your first routine
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routines.map(routine => (
            <SkillCard
              key={routine.id}
              skill={routine}
              onEdit={() => handleEdit(routine)}
              onDelete={() => handleDelete(routine.id)}
              onRun={() => handleRun(routine.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
