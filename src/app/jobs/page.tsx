'use client';

import { useState, useEffect } from 'react';
import JobCard from '@/components/JobCard';

interface Job {
  id: string;
  skill_id?: string;
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<{ job: Job; steps: StepRun[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchJobs = async () => {
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="canceled">Canceled</option>
          </select>
          <button
            onClick={fetchJobs}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {loading ? (
            <p className="text-gray-400">Loading jobs...</p>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No jobs yet</p>
              <p className="text-gray-600 text-sm mt-2">Run a skill or use the API to create jobs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedJob && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Job Details</h2>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">ID</p>
                <p className="text-sm text-gray-200 font-mono">{selectedJob.job.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm text-gray-200">{selectedJob.job.status}</p>
              </div>
              {selectedJob.job.result && (
                <div>
                  <p className="text-xs text-gray-500">Result</p>
                  <pre className="text-xs text-gray-300 bg-gray-900 rounded p-2 overflow-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedJob.job.result), null, 2)}
                  </pre>
                </div>
              )}
              {selectedJob.job.error && (
                <div>
                  <p className="text-xs text-gray-500">Error</p>
                  <p className="text-sm text-red-400">{selectedJob.job.error}</p>
                </div>
              )}
              {selectedJob.steps.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Steps ({selectedJob.steps.length})</p>
                  <div className="space-y-2">
                    {selectedJob.steps.map(step => (
                      <div key={step.id} className="bg-gray-900 rounded-lg p-2">
                        <p className="text-sm text-purple-400 font-medium">{step.tool_name}</p>
                        {step.output && (
                          <pre className="text-xs text-gray-400 mt-1 overflow-auto max-h-20">
                            {JSON.stringify(JSON.parse(step.output), null, 2)}
                          </pre>
                        )}
                        {step.error && (
                          <p className="text-xs text-red-400 mt-1">{step.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
