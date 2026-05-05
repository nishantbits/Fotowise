import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobStore } from '../stores/useJobStore';
import { FolderPicker } from './ui/FolderPicker';
import { Folder, Zap, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';

export function OnboardingModal() {
  const [step, setStep] = useState(1);
  const [folderPath, setFolderPath] = useState('');
  const [activeTab, setActiveTab] = useState<'semantic' | 'facial'>('semantic');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const { jobs } = useJobStore();
  const scanJob = jobs['scan'];
  
  // Real progress from WebSocket
  const [isAgentAlive, setIsAgentAlive] = useState(false);
  const [showForceContinue, setShowForceContinue] = useState(false);
  const [visualProgress, setVisualProgress] = useState(0);
  const lastProgressRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indeterminateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived true percentage math
  const calculateTruePercentage = () => {
    if (!scanJob) return 0;
    if (scanJob.status === 'completed') return 100;
    
    // If we have total and progress, and progress is less than or equal to total, 
    // we assume they are raw counts.
    if (scanJob.total > 0 && scanJob.progress <= scanJob.total) {
      return Math.round((scanJob.progress / scanJob.total) * 100);
    }
    
    // Fallback: if progress is already > 100, or total is 0, just use progress as-is (assuming it's already a percent)
    return scanJob.progress;
  };

  const truePercent = calculateTruePercentage();

  // Smoothly sync visualProgress to truePercent
  useEffect(() => {
    if (step === 4) {
      if (scanJob?.status === 'completed') {
        setVisualProgress(100);
        if (indeterminateIntervalRef.current) clearInterval(indeterminateIntervalRef.current);
      } else if (truePercent > 0) {
        setVisualProgress(prev => Math.max(prev, truePercent));
        if (indeterminateIntervalRef.current) clearInterval(indeterminateIntervalRef.current);
      } else if (scanJob?.status === 'running' && visualProgress < 90) {
        // Indeterminate fallback: slowly crawl up to 90% if we have no real progress yet
        if (!indeterminateIntervalRef.current) {
          indeterminateIntervalRef.current = setInterval(() => {
            setVisualProgress(prev => {
              if (prev >= 90) return prev;
              return prev + 0.5;
            });
          }, 500);
        }
      }
    }
    return () => {
      if (indeterminateIntervalRef.current) clearInterval(indeterminateIntervalRef.current);
    };
  }, [truePercent, scanJob?.status, step]);

  useEffect(() => {
    // Poll for agent status when on the agent check step
    let interval: ReturnType<typeof setInterval>;
    if (step === 2) {
      const checkAgent = async () => {
        try {
          const res = await fetch('/api/watcher/status');
          const data = await res.json();
          setIsAgentAlive(!!data.agentAlive);
          if (data.agentAlive) {
            // Auto-advance if agent is connected
            // setTimeout(() => setStep(3), 1500); // Small delay for UX satisfaction
          }
        } catch (e) {
          setIsAgentAlive(false);
        }
      };
      checkAgent();
      interval = setInterval(checkAgent, 2000);
    }
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    // FAILSAFE: If job status is completed, force 100% and enable continue
    if (scanJob?.status === 'completed' && step === 4) {
      // Just let the natural job store state handle it, 
      // but ensure we show the button immediately
    }
  }, [scanJob?.status, step]);

  useEffect(() => {
    if (step === 4) {
      // If progress happens, reset the timeout
      if (visualProgress > lastProgressRef.current) {
        lastProgressRef.current = visualProgress;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShowForceContinue(false);
      }

      // Always show force continue after a few seconds of initial processing
      // so the user is never trapped
      const timer = setTimeout(() => {
        setShowForceContinue(true);
      }, 5000); 

      return () => clearTimeout(timer);
    }
  }, [step, visualProgress]);

  const handleStartProcessing = async () => {
    if (!folderPath) return;

    try {
      await fetch('/api/watcher/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
      });
      setStep(4);
    } catch (e) {
      console.error('Failed to start watcher', e);
    }
  };

  const handleFinish = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_completed_onboarding: 'true' })
      });
    } catch (e) {
      console.error('Failed to set onboarding flag', e);
    }
    window.location.reload();
  };

  const variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[600px] bg-[#0A0F1C] border-t-4 border-t-cyan-500 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-10 space-y-8"
            >
              <div className="space-y-4">
                <span className="inline-block px-3 py-1 bg-white/10 text-xs font-bold tracking-widest text-cyan-400 rounded-full">
                  WELCOME ABOARD
                </span>
                <h1 className="text-4xl font-bold text-white">Welcome to Fotowise</h1>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Your intelligent companion for photo curation and organization powered by privacy-first AI.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-500">🔒 PRIVACY FIRST</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-sm text-slate-300">
                      All AI processing happens locally on your device. Your photos never leave your computer.
                    </p>
                  </div>
                  <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-sm text-slate-300">
                      Complete control over your data. No tracking, no analytics, no cloud uploads.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
                >
                  Get Started &gt;
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-10 space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-white">Watcher Agent Connection</h1>
                <p className="text-slate-400">Fotowise needs an external agent to monitor your Windows folders.</p>
              </div>

              {!isAgentAlive ? (
                <div className="space-y-6">
                  <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-3 text-red-400 font-semibold">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Agent Disconnected
                    </div>
                    <p className="text-sm text-slate-300">
                      Open a terminal in your project root and run this command:
                    </p>
                    <div className="bg-black/40 p-4 rounded-lg font-mono text-cyan-400 text-sm border border-slate-700/50">
                      node watcher-agent.js
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-3 text-slate-500 py-4">
                    <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium animate-pulse">Waiting for agent to connect...</span>
                  </div>
                </div>
              ) : (
                <div className="p-10 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-4xl shadow-lg shadow-emerald-500/20">
                    ✅
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Agent Connected!</h3>
                    <p className="text-emerald-400/80 mt-1">The bridge to your filesystem is secure.</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!isAgentAlive}
                  className={`px-8 py-3 font-semibold rounded-xl transition-all ${
                    isAgentAlive 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  Continue &gt;
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-10 space-y-8"
            >
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold tracking-wider text-slate-500 uppercase">
                    Select your photo library
                  </label>
                  
                  <div className="relative group">
                    <input
                      type="text"
                      readOnly
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-5 text-white pr-36 focus:ring-2 focus:ring-cyan-500/30 transition-all cursor-default"
                      placeholder="No folder selected..."
                      value={folderPath}
                    />
                    <button
                      onClick={() => setIsPickerOpen(true)}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
                    >
                      <Folder className="w-4 h-4" />
                      Browse PC
                    </button>
                  </div>
                  
                  {folderPath && (
                    <div className="flex items-center gap-2 px-2 text-emerald-400 text-xs font-medium animate-in fade-in slide-in-from-top-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready to index: {folderPath.split(/[\\/]/).pop()}
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-2xl border border-cyan-500/10 bg-cyan-500/5 flex gap-4">
                  <div className="p-2 bg-cyan-500/20 rounded-lg h-fit">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    <strong className="text-cyan-400">Pro Tip:</strong> For the best results, select a directory with at least 100+ photos. This allows Fotowise to build a more accurate semantic index of your memories.
                  </p>
                </div>
              </div>

              <FolderPicker 
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={(path) => {
                  setFolderPath(path);
                  setIsPickerOpen(false);
                }}
                initialPath={folderPath}
              />

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 text-slate-400 hover:text-white font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleStartProcessing}
                  disabled={!folderPath}
                  className={`px-8 py-3 font-semibold rounded-xl transition-all ${
                    folderPath 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  Next: Calibrate AI &gt;
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step3"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="p-10 space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-white">Processing Your Photos</h1>
                <p className="text-slate-400">Building your personalized AI model...</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-cyan-400 font-medium">
                    {scanJob?.status === 'completed' ? 'Processing Complete' : 'Optimizing Library'}
                  </span>
                  <span className="text-slate-300 font-mono">{Math.floor(visualProgress)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${visualProgress}%` }}
                    className={`h-full transition-all duration-500 ease-out ${
                      visualProgress >= 100 
                        ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                        : 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                    }`}
                  />
                </div>
                {scanJob?.total > 0 && scanJob?.status !== 'completed' && (
                  <p className="text-[10px] text-slate-500 text-right uppercase tracking-widest font-bold pt-1">
                    Indexing {scanJob.progress} of {scanJob.total} files
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-semibold tracking-wider text-slate-500">CAPABILITIES BEING CALIBRATED</h2>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('semantic')}
                    className={`flex-1 py-3 text-sm font-medium rounded-lg border transition-all ${
                      activeTab === 'semantic'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Semantic Search
                  </button>
                  <button
                    onClick={() => setActiveTab('facial')}
                    className={`flex-1 py-3 text-sm font-medium rounded-lg border transition-all ${
                      activeTab === 'facial'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Facial Recognition
                  </button>
                </div>

                <div className="p-5 bg-slate-800/50 rounded-xl border border-slate-700/50 min-h-[100px]">
                  {activeTab === 'semantic' ? (
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Semantic search lets you describe what you're looking for in natural language. We're analyzing the visual content of your photos to understand objects, scenes, and context without needing manual tags.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Facial recognition is mapping the unique features of people in your photos. This allows you to quickly find all photos of specific individuals, completely offline and private.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 gap-3">
                {showForceContinue && (
                  <button
                    onClick={handleFinish}
                    className="px-6 py-3 border border-slate-700/50 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-sm font-medium"
                  >
                    Skip & Enter Dashboard
                  </button>
                )}
                <button
                  onClick={handleFinish}
                  disabled={visualProgress < 100 && scanJob?.status !== 'completed'}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {visualProgress < 100 && scanJob?.status !== 'completed' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Calibrating...
                    </>
                  ) : (
                    <>
                      Enter Fotowise
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
