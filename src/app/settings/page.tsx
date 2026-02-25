'use client';

import { useState, useEffect, useCallback } from 'react';

const USER_ID = 'user_default';

const AGENT_NAMES = [
  'Sara', 'Alfred', 'Luna', 'Max', 'Nova', 'Echo',
  'Aria', 'Leo', 'Kai', 'Iris', 'Zoe', 'Rex',
  'Quinn', 'Mia', 'Axel', 'Nora', 'Eden', 'Orion',
  'Lyra', 'Atlas', 'Cleo', 'Hugo', 'Mira', 'Finn',
];

const INTEREST_SUGGESTIONS = [
  'coding', 'music', 'sports', 'travel', 'cooking',
  'reading', 'gaming', 'art', 'science', 'fitness',
  'design', 'finance', 'language', 'movies', 'writing',
];

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0',
};

const focusStyle = {
  border: '1px solid rgba(139,92,246,0.4)',
  outline: 'none',
};

function randomName(): string {
  return AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
        {label}
        {hint && <span className="ml-1.5 font-normal" style={{ color: '#475569' }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'rgba(10,10,20,0.8)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <h2 className="text-sm font-semibold mb-5" style={{ color: '#94a3b8' }}>{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // User fields
  const [displayName, setDisplayName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');

  // Agent fields
  const [agentName, setAgentName] = useState('');
  const [agentPersonality, setAgentPersonality] = useState('');
  const [agentStyle, setAgentStyle] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${USER_ID}`);
      const data = await res.json();
      const user = data.user;
      const prefs = user?.preferences ?? {};

      setDisplayName(user?.displayName || '');
      setPreferredName(user?.preferredName || '');
      setTimezone(user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setInterests(prefs.interests || []);
      setAgentName(prefs.agent?.name || '');
      setAgentPersonality(prefs.agent?.personality || '');
      setAgentStyle(prefs.agent?.style || '');
    } catch {
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addInterest = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !interests.includes(t)) setInterests(prev => [...prev, t]);
    setInterestInput('');
  };

  const removeInterest = (tag: string) => setInterests(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/users/${USER_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || 'User',
          preferredName: preferredName.trim(),
          timezone,
          interests,
          agent: {
            name: agentName.trim() || randomName(),
            personality: agentPersonality.trim(),
            style: agentStyle.trim(),
          },
          onboarded: true,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const remainingSuggestions = INTEREST_SUGGESTIONS.filter(s => !interests.includes(s));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
          <span className="w-2 h-2 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
          <span className="w-2 h-2 rounded-full typing-dot" style={{ background: '#8b5cf6' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Update your profile and agent configuration.
        </p>
      </div>

      {/* About You */}
      <Section title="About You">
        <Field label="Your Name">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        </Field>

        <Field label="Preferred Name" hint="(what should the agent call you?)">
          <input
            type="text"
            value={preferredName}
            onChange={e => setPreferredName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        </Field>

        <Field label="Timezone">
          <input
            type="text"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        </Field>

        <Field label="Interests" hint="(optional)">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={interestInput}
              onChange={e => setInterestInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addInterest(interestInput); }
              }}
              placeholder="Add an interest…"
              className="flex-1 px-3 py-2 rounded-xl text-sm transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
            />
            <button
              onClick={() => addInterest(interestInput)}
              className="px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              Add
            </button>
          </div>

          {remainingSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {remainingSuggestions.slice(0, 8).map(s => (
                <button
                  key={s}
                  onClick={() => addInterest(s)}
                  className="text-xs px-2 py-0.5 rounded-full transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                >
                  + {s}
                </button>
              ))}
            </div>
          )}

          {interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {interests.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}
                >
                  {tag}
                  <button
                    onClick={() => removeInterest(tag)}
                    className="opacity-60 hover:opacity-100 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>
      </Section>

      {/* Agent */}
      <Section title="Your Agent">
        <Field label="Agent Name">
          <div className="flex gap-2">
            <input
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={inputStyle}
              onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
              onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
            />
            <button
              onClick={() => setAgentName(randomName())}
              title="Random name"
              className="px-3 py-2 rounded-xl text-base transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
            >
              🎲
            </button>
          </div>
        </Field>

        <Field label="Personality">
          <textarea
            value={agentPersonality}
            onChange={e => setAgentPersonality(e.target.value)}
            rows={3}
            placeholder="Describe the agent's character and values."
            className="w-full px-3 py-2.5 rounded-xl text-sm resize-none transition-all"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        </Field>

        <Field label="Speaking Style">
          <textarea
            value={agentStyle}
            onChange={e => setAgentStyle(e.target.value)}
            rows={3}
            placeholder="How the agent communicates — tone and verbosity."
            className="w-full px-3 py-2.5 rounded-xl text-sm resize-none transition-all"
            style={inputStyle}
            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
          />
        </Field>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3 justify-end">
        {error && (
          <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>
        )}
        {saved && (
          <p className="text-xs" style={{ color: '#34d399' }}>Saved successfully.</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: saving ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
            color: saving ? '#475569' : '#fff',
            boxShadow: saving ? 'none' : '0 0 20px rgba(124,58,237,0.3)',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
