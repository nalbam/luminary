'use client';

import { useState, useEffect } from 'react';

interface Skill {
  id: string;
  name: string;
  type: string;
  config: string;
  status: 'connected' | 'unconfigured' | 'error';
  enabled: number;
  last_tested_at: string | null;
  created_at: string;
}

const SKILL_TYPES = ['telegram', 'slack', 'google_calendar', 'webhook', 'custom'] as const;

const typeConfig: Record<string, { icon: string; label: string; configFields: { key: string; label: string; placeholder: string; isEnvRef?: boolean }[] }> = {
  telegram: {
    icon: '✈',
    label: 'Telegram',
    configFields: [
      { key: 'bot_token_env', label: 'Bot Token (env var name)', placeholder: 'TELEGRAM_BOT_TOKEN', isEnvRef: true },
      { key: 'chat_id_env', label: 'Chat ID (env var name)', placeholder: 'TELEGRAM_CHAT_ID', isEnvRef: true },
    ],
  },
  slack: {
    icon: '#',
    label: 'Slack',
    configFields: [
      { key: 'webhook_url_env', label: 'Webhook URL (env var name)', placeholder: 'SLACK_WEBHOOK_URL', isEnvRef: true },
    ],
  },
  google_calendar: {
    icon: '📅',
    label: 'Google Calendar',
    configFields: [
      { key: 'calendar_id', label: 'Calendar ID', placeholder: 'primary' },
    ],
  },
  webhook: {
    icon: '🔗',
    label: 'Webhook',
    configFields: [
      { key: 'url', label: 'Webhook URL', placeholder: 'https://example.com/hook' },
      { key: 'method', label: 'HTTP Method', placeholder: 'POST' },
    ],
  },
  custom: {
    icon: '⚙',
    label: 'Custom',
    configFields: [
      { key: 'endpoint', label: 'Endpoint', placeholder: 'https://api.example.com/v1' },
    ],
  },
};

const statusConfig: Record<string, { color: string; bg: string; dot: string }> = {
  connected:    { color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)',  dot: '#10b981' },
  unconfigured: { color: '#fcd34d', bg: 'rgba(245,158,11,0.12)', dot: '#f59e0b' },
  error:        { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)',   dot: '#ef4444' },
};

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

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('telegram');
  const [form, setForm] = useState<{ name: string; type: string; config: Record<string, string> }>({
    name: '',
    type: 'telegram',
    config: {},
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
      await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, type: form.type, config: form.config }),
      });
      setShowForm(false);
      setForm({ name: '', type: 'telegram', config: {} });
      fetchSkills();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this integration?')) return;
    await fetch(`/api/skills/${id}`, { method: 'DELETE' });
    fetchSkills();
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setForm(prev => ({ ...prev, type, config: {} }));
  };

  const currentTypeConfig = typeConfig[selectedType] || typeConfig.custom;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Skills</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            Integration modules — Telegram, Slack, and more
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#f1f5f9', boxShadow: '0 0 20px rgba(14,165,233,0.35)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 28px rgba(14,165,233,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(14,165,233,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <span className="text-base leading-none">+</span>
          Add Integration
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: '#0d0d18', border: '1px solid rgba(14,165,233,0.3)', boxShadow: '0 0 60px rgba(14,165,233,0.2)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold" style={{ color: '#e2e8f0' }}>Add Integration</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#e2e8f0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>Integration Type</label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeChange(t)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150"
                      style={
                        selectedType === t
                          ? { background: 'rgba(14,165,233,0.2)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.4)' }
                          : { background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }
                      }
                    >
                      {typeConfig[t]?.icon} {typeConfig[t]?.label || t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Display Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  style={inputStyle}
                  placeholder={`e.g., My ${currentTypeConfig.label}`}
                  required
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
              </div>
              {/* Dynamic config fields */}
              {currentTypeConfig.configFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                    {field.label}
                    {field.isEnvRef && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#fcd34d' }}>
                        env var name
                      </span>
                    )}
                  </label>
                  <input
                    value={form.config[field.key] || ''}
                    onChange={e => setForm(p => ({ ...p, config: { ...p.config, [field.key]: e.target.value } }))}
                    style={inputStyle}
                    placeholder={field.placeholder}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.5)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  />
                  {field.isEnvRef && (
                    <p className="text-xs mt-1" style={{ color: '#475569' }}>
                      Enter the name of the environment variable (e.g. TELEGRAM_BOT_TOKEN), not the actual value.
                    </p>
                  )}
                </div>
              ))}
              {selectedType === 'google_calendar' && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-xs" style={{ color: '#fcd34d' }}>Google Calendar OAuth is planned for a future release. This creates a placeholder integration.</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#f1f5f9', boxShadow: '0 0 18px rgba(14,165,233,0.3)' }}
                >
                  Add Integration
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl text-sm"
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
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 typing-dot" />
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 typing-dot" />
        </div>
      ) : skills.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <div className="text-4xl mb-3">🔌</div>
          <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>No integrations yet</p>
          <p className="text-xs mt-1 mb-6" style={{ color: '#475569' }}>Connect Telegram, Slack, or other services</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(14,165,233,0.15)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.3)' }}
          >
            + Add your first integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map(skill => {
            const tc = typeConfig[skill.type] || typeConfig.custom;
            const sc = statusConfig[skill.status] || statusConfig.unconfigured;
            let config: Record<string, string> = {};
            try { config = JSON.parse(skill.config || '{}'); } catch { config = {}; }

            return (
              <div
                key={skill.id}
                className="group rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: `3px solid ${sc.dot}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.055)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{tc.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>{skill.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                          {tc.label}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block" style={{ background: sc.bg, color: sc.color }}>
                        {skill.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(skill.id)}
                    className="text-xs px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  >
                    Delete
                  </button>
                </div>

                {/* Config summary */}
                {Object.keys(config).length > 0 && (
                  <div className="flex flex-col gap-1">
                    {Object.entries(config).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <span style={{ color: '#475569' }}>{k}:</span>
                        <span className="font-mono" style={{ color: '#64748b' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {skill.last_tested_at && (
                  <p className="text-xs" style={{ color: '#334155' }}>
                    Last tested: {new Date(skill.last_tested_at).toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
