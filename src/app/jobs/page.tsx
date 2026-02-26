'use client';

import { useState, useEffect } from 'react';
import JobCard from '@/components/JobCard';

interface Job {
  id: string;
  routine_id?: string;
  routine_name?: string;
  tool_name?: string;
  trigger_type: string;
  status: string;
  input?: string;
  result?: string;
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface StepRun {
  id: string;
  tool_name: string;
  input?: string;
  output?: string;
  error?: string;
  started_at: string;
  completed_at?: string;
}

const statusConfig: Record<string, { color: string; bg: string }> = {
  queued:    { color: '#fcd34d', bg: 'rgba(245,158,11,0.12)' },
  running:   { color: '#93c5fd', bg: 'rgba(59,130,246,0.12)' },
  succeeded: { color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)' },
  failed:    { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)' },
  canceled:  { color: '#94a3b8', bg: 'rgba(100,116,139,0.12)' },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<{ job: Job; steps: StepRun[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/jobs?status=${statusFilter}` : '/api/jobs';
      const res = await fetch(url);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, [statusFilter]);

  const handleJobClick = async (job: Job) => {
    const res = await fetch(`/api/jobs/${job.id}`);
    const data = await res.json();
    setSelectedJob(data);
  };

  const selectStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0',
    borderRadius: '10px',
    padding: '7px 12px',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  } as const;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#f1f5f9' }}>Jobs</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
            Track every task your agent runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>
          <button
            onClick={fetchJobs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Job list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center gap-2 py-16 justify-center" style={{ color: '#475569' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 typing-dot" />
            </div>
          ) : jobs.length === 0 ? (
            <div
              className="text-center py-16 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
            >
              <div className="text-3xl mb-3">⚙</div>
              <p className="text-sm" style={{ color: '#64748b' }}>No jobs yet</p>
              <p className="text-xs mt-1" style={{ color: '#334155' }}>Run a routine to create jobs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedJob?.job.id === job.id}
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {selectedJob ? (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: '80px' }}
            >
              {/* Detail header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs font-mono mb-1" style={{ color: '#475569' }}>{selectedJob.job.id}</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cfg = statusConfig[selectedJob.job.status] || statusConfig.canceled;
                      return (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>
                          {selectedJob.job.status}
                        </span>
                      );
                    })()}
                    <span className="text-xs" style={{ color: '#475569' }}>{selectedJob.job.trigger_type}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e2e8f0'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
                >
                  ✕
                </button>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Created', value: selectedJob.job.created_at },
                  { label: 'Started', value: selectedJob.job.started_at },
                  { label: 'Completed', value: selectedJob.job.completed_at },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs mb-1" style={{ color: '#475569' }}>{label}</p>
                    <p className="text-xs font-mono" style={{ color: value ? '#94a3b8' : '#334155' }}>
                      {value ? new Date(value).toLocaleTimeString() : '—'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Result */}
              {selectedJob.job.result && (
                <div className="mb-4">
                  <p className="text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>Result</p>
                  <pre
                    className="text-xs rounded-xl p-3 overflow-auto max-h-40"
                    style={{ background: 'rgba(255,255,255,0.03)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {JSON.stringify(JSON.parse(selectedJob.job.result), null, 2)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {selectedJob.job.error && (
                <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#f87171' }}>Error</p>
                  <p className="text-xs" style={{ color: '#fca5a5' }}>{selectedJob.job.error}</p>
                </div>
              )}

              {/* Step runs */}
              {selectedJob.steps.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-3" style={{ color: '#94a3b8' }}>
                    Steps · {selectedJob.steps.length}
                  </p>
                  <div className="relative pl-4">
                    {/* Timeline line */}
                    <div className="absolute left-1.5 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div className="space-y-3">
                      {selectedJob.steps.map((step, idx) => (
                        <div key={step.id} className="relative">
                          {/* Dot */}
                          <div
                            className="absolute -left-3.5 top-3 w-2 h-2 rounded-full"
                            style={{ background: step.error ? '#ef4444' : '#8b5cf6' }}
                          />
                          <div
                            className="rounded-xl p-3"
                            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium font-mono" style={{ color: '#a78bfa' }}>
                                {idx + 1}. {step.tool_name}
                              </span>
                              {step.completed_at && (
                                <span className="text-xs" style={{ color: '#334155' }}>
                                  {new Date(step.completed_at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {step.output && (
                              <pre
                                className="text-xs mt-1.5 overflow-auto max-h-20 rounded-lg p-2"
                                style={{ background: 'rgba(0,0,0,0.25)', color: '#64748b' }}
                              >
                                {JSON.stringify(JSON.parse(step.output), null, 2)}
                              </pre>
                            )}
                            {step.error && (
                              <p className="text-xs mt-1" style={{ color: '#f87171' }}>⚠ {step.error}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-20"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}
            >
              <div className="text-3xl mb-3 opacity-30">⚙</div>
              <p className="text-sm" style={{ color: '#334155' }}>Select a job to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
