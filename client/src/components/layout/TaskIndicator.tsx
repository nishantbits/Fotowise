import { useState, useEffect } from 'react';
import { useJobStore, type Job } from '../../stores/useJobStore';
import { Sparkles, CheckCircle, XCircle, ChevronUp, ChevronDown } from 'lucide-react';

const JOB_TYPE_LABELS: Record<string, string> = {
  ai_index: 'AI Indexing',
  rebuild_thumbnails: 'Rebuilding Thumbnails',
  face_cluster: 'Face Clustering',
};

function ProgressRing({ pct, size = 28 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  );
}

function JobRow({ job }: { job: Job }) {
  const pct = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;
  const label = JOB_TYPE_LABELS[job.type] ?? job.type;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative flex-shrink-0">
        {job.status === 'running' && <ProgressRing pct={pct} />}
        {job.status === 'completed' && (
          <CheckCircle size={24} className="text-[var(--accent)]" />
        )}
        {job.status === 'failed' && (
          <XCircle size={24} className="text-red-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{label}</p>
        {job.status === 'running' && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-400 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] tabular-nums flex-shrink-0">
              {job.progress}/{job.total}
            </span>
          </div>
        )}
        {job.status === 'completed' && (
          <p className="text-[10px] text-[var(--accent)] mt-0.5">Done — {job.total} photos indexed</p>
        )}
        {job.status === 'failed' && (
          <p className="text-[10px] text-red-400 mt-0.5 truncate">{job.error || 'Task failed'}</p>
        )}
      </div>
    </div>
  );
}

export function TaskIndicator() {
  const activeJob = useJobStore((s) => s.activeJob());
  const jobs = useJobStore((s) => s.jobs);
  const wsConnected = useJobStore((s) => s.wsConnected);

  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  // Show the indicator whenever there's an active/recent job
  useEffect(() => {
    if (activeJob) {
      setVisible(true);
    } else {
      // Hide after a short delay when nothing is happening
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [activeJob]);

  // Auto-collapse completed jobs after 5 s
  useEffect(() => {
    if (activeJob?.status === 'completed') {
      const t = setTimeout(() => setExpanded(false), 5000);
      return () => clearTimeout(t);
    }
  }, [activeJob?.status]);

  if (!visible) return null;

  const allJobs = Object.values(jobs);
  const runningCount = allJobs.filter((j) => j.status === 'running').length;

  return (
    <div
      className="relative"
      style={{ zIndex: 50 }}
    >
      {/* Trigger pill */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300
          ${runningCount > 0
            ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
            : 'bg-white/5 border-white/10 text-[var(--text-secondary)]'
          }
        `}
        title="AI Task Progress"
        aria-label="View AI task progress"
      >
        {runningCount > 0 ? (
          <Sparkles size={14} className="animate-pulse" />
        ) : (
          <CheckCircle size={14} />
        )}
        <span className="text-xs font-semibold">
          {runningCount > 0 ? `AI Processing…` : 'AI Done'}
        </span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {/* Dropdown panel */}
      {expanded && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[rgba(13,15,21,0.95)] border border-white/10 shadow-2xl backdrop-blur-xl p-4"
          style={{ zIndex: 60 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              AI Tasks
            </span>
            <span
              className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[var(--accent)]' : 'bg-red-500'}`}
              title={wsConnected ? 'Connected' : 'Disconnected'}
            />
          </div>

          <div className="divide-y divide-white/5">
            {allJobs.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-2">No recent tasks.</p>
            ) : (
              allJobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
