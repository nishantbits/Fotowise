import { create } from 'zustand';

export type JobStatus = 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  total: number;
  error?: string;
}

interface JobState {
  jobs: Record<string, Job>;
  wsConnected: boolean;
  // Actions
  upsertJob: (job: Job) => void;
  updateProgress: (jobId: string, progress: number) => void;
  markCompleted: (jobId: string, total: number) => void;
  markFailed: (jobId: string, error: string) => void;
  setWsConnected: (connected: boolean) => void;
  // Selectors
  activeJob: () => Job | null;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: {},
  wsConnected: false,

  upsertJob: (job) =>
    set((state) => ({ jobs: { ...state.jobs, [job.id]: job } })),

  updateProgress: (jobId, progress) =>
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      return { jobs: { ...state.jobs, [jobId]: { ...job, progress } } };
    }),

  markCompleted: (jobId, total) =>
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [jobId]: { ...job, status: 'completed', progress: total, total },
        },
      };
    }),

  markFailed: (jobId, error) =>
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [jobId]: { ...job, status: 'failed', error },
        },
      };
    }),

  setWsConnected: (wsConnected) => set({ wsConnected }),

  // Returns the most recent running job, or the most recent job of any status
  activeJob: () => {
    const all = Object.values(get().jobs);
    const running = all.filter((j) => j.status === 'running');
    if (running.length > 0) return running[0];
    // Show recently completed/failed for a brief moment
    return all[all.length - 1] ?? null;
  },
}));
