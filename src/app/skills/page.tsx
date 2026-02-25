'use client';

import { useState, useEffect } from 'react';
import SkillCard from '@/components/SkillCard';

interface Skill {
  id: string;
  name: string;
  goal: string;
  trigger_type: string;
  tools?: string;
  enabled: number;
  created_at: string;
}

const AVAILABLE_TOOLS = ['summarize', 'remember', 'list_memory', 'web_search'];

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState({
    name: '',
    goal: '',
    triggerType: 'manual',
    tools: [] as string[],
    budget: '{}',
  });

  const fetchSkills = async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      setSkills(data.skills || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSkills(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingSkill ? `/api/skills/${editingSkill.id}` : '/api/skills';
      const method = editingSkill ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          goal: form.goal,
          triggerType: form.triggerType,
          tools: form.tools,
        }),
      });

      setShowForm(false);
      setEditingSkill(null);
      setForm({ name: '', goal: '', triggerType: 'manual', tools: [], budget: '{}' });
      fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this skill?')) return;
    await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    fetchSkills();
  };

  const handleRun = async (skillId: string) => {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, triggerType: 'manual', runNow: true }),
    });
    alert('Job enqueued! Check the Jobs page for status.');
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    let parsedTools: string[] = [];
    try { parsedTools = JSON.parse(skill.tools || '[]'); } catch { parsedTools = []; }
    setForm({
      name: skill.name,
      goal: skill.goal,
      triggerType: skill.trigger_type,
      tools: parsedTools,
      budget: '{}',
    });
    setShowForm(true);
  };

  const toggleTool = (tool: string) => {
    setForm(prev => ({
      ...prev,
      tools: prev.tools.includes(tool)
        ? prev.tools.filter(t => t !== tool)
        : [...prev.tools, tool],
    }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Skills</h1>
        <button
          onClick={() => { setShowForm(true); setEditingSkill(null); setForm({ name: '', goal: '', triggerType: 'manual', tools: [], budget: '{}' }); }}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New Skill
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingSkill ? 'Edit Skill' : 'Create Skill'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Daily Summary"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Goal</label>
              <textarea
                value={form.goal}
                onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="What should this skill accomplish?"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Trigger Type</label>
              <select
                value={form.triggerType}
                onChange={e => setForm(p => ({ ...p, triggerType: e.target.value }))}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="manual">Manual</option>
                <option value="schedule">Schedule</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tools</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TOOLS.map(tool => (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      form.tools.includes(tool)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {editingSkill ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingSkill(null); }} className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading skills...</p>
      ) : skills.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No skills yet</p>
          <p className="text-gray-600 text-sm mt-2">Create a skill to automate tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => handleEdit(skill)}
              onDelete={() => handleDelete(skill.id)}
              onRun={() => handleRun(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
