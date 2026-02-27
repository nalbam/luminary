'use client';

import { useState } from 'react';

const AGENT_NAMES = [
  'Sara', 'Alfred', 'Luna', 'Max', 'Nova', 'Echo',
  'Aria', 'Leo', 'Kai', 'Iris', 'Zoe', 'Rex',
  'Quinn', 'Mia', 'Axel', 'Nora', 'Eden', 'Orion',
  'Lyra', 'Atlas', 'Cleo', 'Hugo', 'Mira', 'Finn',
];

const DEFAULT_PERSONALITY =
  'Helpful, thoughtful, and direct. Curious about the world and eager to assist.';
const DEFAULT_STYLE =
  'Conversational and warm, but concise. Gets to the point without being curt.';

const INTEREST_SUGGESTIONS = [
  'coding', 'music', 'sports', 'travel', 'cooking',
  'reading', 'gaming', 'art', 'science', 'fitness',
  'design', 'finance', 'language', 'movies', 'writing',
];

export interface OnboardingData {
  displayName: string;
  preferredName: string;
  timezone: string;
  interests: string[];
  agent: {
    name: string;
    personality: string;
    style: string;
  };
}

interface OnboardingModalProps {
  onComplete: (data: OnboardingData) => void;
  initialData?: Partial<OnboardingData & { agent: Partial<OnboardingData['agent']> }>;
}

function randomName(): string {
  return AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0',
};

const focusStyle = {
  border: '1px solid rgba(139,92,246,0.4)',
  outline: 'none',
};

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

export default function OnboardingModal({ onComplete, initialData }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — About You (pre-fill from existing user data if available)
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [preferredName, setPreferredName] = useState(initialData?.preferredName || '');
  const [timezone, setTimezone] = useState(
    initialData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [interests, setInterests] = useState<string[]>(initialData?.interests || []);
  const [interestInput, setInterestInput] = useState('');

  // Step 2 — Your Agent (pre-fill from existing agent config if available)
  const [agentName, setAgentName] = useState(initialData?.agent?.name || randomName());
  const [agentPersonality, setAgentPersonality] = useState(
    initialData?.agent?.personality || DEFAULT_PERSONALITY
  );
  const [agentStyle, setAgentStyle] = useState(initialData?.agent?.style || DEFAULT_STYLE);

  const addInterest = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !interests.includes(t)) setInterests(prev => [...prev, t]);
    setInterestInput('');
  };

  const removeInterest = (tag: string) => setInterests(prev => prev.filter(t => t !== tag));

  const handleFinish = async () => {
    setSaving(true);
    onComplete({
      displayName: displayName.trim() || 'User',
      preferredName: preferredName.trim(),
      timezone,
      interests,
      agent: {
        name: agentName.trim() || randomName(),
        personality: agentPersonality.trim() || DEFAULT_PERSONALITY,
        style: agentStyle.trim() || DEFAULT_STYLE,
      },
    });
  };

  const canContinue = displayName.trim().length > 0;
  const canFinish = agentName.trim().length > 0;

  const remainingSuggestions = INTEREST_SUGGESTIONS.filter(s => !interests.includes(s));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl"
        style={{
          background: 'rgba(10,10,20,0.97)',
          border: '1px solid rgba(139,92,246,0.35)',
          boxShadow: '0 0 80px rgba(139,92,246,0.12), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-7 pt-7 pb-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            {/* Step dots */}
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200"
                  style={
                    step === s
                      ? { background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: '#fff', boxShadow: '0 0 12px rgba(124,58,237,0.4)' }
                      : step > s
                      ? { background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {step > s ? '✓' : s}
                </div>
                {s < 2 && (
                  <div
                    className="w-10 h-px transition-all duration-300"
                    style={{ background: step > s ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)' }}
                  />
                )}
              </div>
            ))}
          </div>
          <span className="text-xs" style={{ color: '#475569' }}>{step} / 2</span>
        </div>

        {/* Content */}
        <div className="px-7 py-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold" style={{ color: '#f1f5f9' }}>
              {step === 1 ? '👋 About You' : '🤖 Your Agent'}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
              {step === 1
                ? "Let me know a bit about you so I can personalize our experience."
                : "Configure your AI agent. All fields have defaults — change what you'd like."}
            </p>
          </div>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Your Name">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canContinue && setStep(2)}
                  placeholder="e.g. Jane Doe"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                />
              </Field>

              <Field label="Preferred Name" hint="(optional — what should I call you?)">
                <input
                  type="text"
                  value={preferredName}
                  onChange={e => setPreferredName(e.target.value)}
                  placeholder="e.g. Jane"
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

                {/* Suggestions */}
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

                {/* Added tags */}
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
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              <Field label="Agent Name">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agentName}
                    onChange={e => setAgentName(e.target.value)}
                    autoFocus
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
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  This is how your agent introduces itself.
                </p>
              </Field>

              <Field label="Personality">
                <textarea
                  value={agentPersonality}
                  onChange={e => setAgentPersonality(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                />
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  Describe the agent&apos;s character and values.
                </p>
              </Field>

              <Field label="Speaking Style">
                <textarea
                  value={agentStyle}
                  onChange={e => setAgentStyle(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none transition-all"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                />
                <p className="text-xs mt-1" style={{ color: '#475569' }}>
                  How the agent communicates — tone and verbosity.
                </p>
              </Field>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div
          className="flex items-center justify-between px-7 py-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-xl text-sm transition-all"
            style={
              step === 1
                ? { visibility: 'hidden' }
                : { color: '#64748b', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            ← Back
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="px-6 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: canContinue
                  ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                  : 'rgba(255,255,255,0.06)',
                color: canContinue ? '#fff' : '#475569',
                boxShadow: canContinue ? '0 0 20px rgba(124,58,237,0.3)' : 'none',
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canFinish || saving}
              className="px-6 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: canFinish && !saving
                  ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
                  : 'rgba(255,255,255,0.06)',
                color: canFinish && !saving ? '#fff' : '#475569',
                boxShadow: canFinish && !saving ? '0 0 20px rgba(124,58,237,0.3)' : 'none',
              }}
            >
              {saving ? 'Setting up…' : 'Get Started ✨'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
