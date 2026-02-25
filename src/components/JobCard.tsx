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

interface JobCardProps {
  job: Job;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  queued: 'bg-yellow-600 text-yellow-100',
  running: 'bg-blue-600 text-blue-100',
  succeeded: 'bg-green-600 text-green-100',
  failed: 'bg-red-600 text-red-100',
  canceled: 'bg-gray-600 text-gray-100',
};

export default function JobCard({ job, onClick }: JobCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-gray-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-gray-400 truncate">{job.id.slice(0, 8)}...</p>
          <p className="text-gray-200 text-sm mt-1">
            Trigger: <span className="text-purple-400">{job.trigger_type}</span>
          </p>
          {job.skill_id && (
            <p className="text-gray-400 text-xs mt-0.5">Skill: {job.skill_id.slice(0, 8)}...</p>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[job.status] || 'bg-gray-600 text-gray-100'}`}>
          {job.status}
        </span>
      </div>
      <p className="text-gray-500 text-xs mt-2">
        {new Date(job.created_at).toLocaleString()}
      </p>
      {job.error && (
        <p className="text-red-400 text-xs mt-1 truncate">{job.error}</p>
      )}
    </div>
  );
}
