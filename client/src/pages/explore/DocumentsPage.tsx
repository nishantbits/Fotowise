import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToastStore } from '../../stores/useToastStore';
import { useMediaStore } from '../../stores/useMediaStore';
import { ArrowLeft, Search, Download, FileText, File, FileCode2, Receipt, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useTilt } from '../../hooks/useTilt';
import { motion, AnimatePresence } from 'framer-motion';

const TYPE_COLORS: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  passport:    { color: '#22c982', bg: 'rgba(34,201,130,0.09)', icon: FileText, label: 'PASSPORT' },
  id_card:     { color: '#22c982', bg: 'rgba(34,201,130,0.09)', icon: FileText, label: 'ID CARD' },
  bill:        { color: '#5590f0', bg: 'rgba(85,144,240,0.09)', icon: Receipt, label: 'BILL' },
  invoice:     { color: '#e8a228', bg: 'rgba(232,162,40,0.09)', icon: Receipt, label: 'INVOICE' },
  form:        { color: '#e8a228', bg: 'rgba(232,162,40,0.09)', icon: FileText, label: 'FORM' },
  certificate: { color: '#d870a0', bg: 'rgba(216,112,160,0.09)', icon: FileCode2, label: 'CERTIFICATE' },
  ticket:      { color: '#5590f0', bg: 'rgba(85,144,240,0.09)', icon: File, label: 'TICKET' },
  receipt:     { color: '#22c982', bg: 'rgba(34,201,130,0.09)', icon: Receipt, label: 'RECEIPT' },
  letter:      { color: '#22c982', bg: 'rgba(34,201,130,0.09)', icon: FileText, label: 'LETTER' },
  contract:    { color: '#e8a228', bg: 'rgba(232,162,40,0.09)', icon: FileText, label: 'CONTRACT' },
  permit:      { color: '#d870a0', bg: 'rgba(216,112,160,0.09)', icon: FileText, label: 'PERMIT' },
  unknown:     { color: '#788880', bg: 'rgba(120,136,128,0.09)', icon: File, label: 'UNKNOWN' },
};

function DocumentCard({ item, onContextMenu, onClick }: any) {
  const tiltRef = useTilt(true);
  const typeInfo = TYPE_COLORS[item.documentType] || TYPE_COLORS.unknown;
  const Icon = typeInfo.icon;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      className="group relative cursor-pointer outline-none"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, item);
      }}
    >
      <div
        ref={tiltRef}
        className="relative flex flex-col w-full h-full overflow-hidden rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border)] transition-all duration-300 group-hover:border-white/20 group-hover:shadow-lg"
      >
        <div 
          className="h-[112px] w-full flex items-center justify-center relative p-3"
          style={{ backgroundColor: typeInfo.bg }}
        >
          <Icon size={40} style={{ color: typeInfo.color }} className="opacity-80" strokeWidth={1.5} />
          
          <div 
            className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider pointer-events-none"
            style={{ color: typeInfo.color, backgroundColor: `${typeInfo.color}20` }}
          >
            {typeInfo.label}
          </div>
          
          {item.documentConfidence > 0.9 && (
            <div className="absolute bottom-2 left-2 text-[10px] text-white/40 flex items-center gap-1">
              <Check size={10} className="text-[var(--accent-green)]" /> Confirmed
            </div>
          )}
        </div>
        
        <div className="p-3 flex flex-col gap-1 border-t border-[var(--border)] bg-[var(--bg-primary)] h-full">
          <p className="text-[var(--t1)] text-xs font-medium truncate w-full" title={item.filename}>
            {item.filename}
          </p>
          {(item.ocr_merchant || item.ocr_amount) && (
             <div className="text-[10px] text-[var(--t2)] flex justify-between mt-0.5">
                <span className="truncate pr-2">{item.ocr_merchant || 'Unknown'}</span>
                <span className="font-semibold text-green-400">{item.ocr_amount}</span>
             </div>
          )}
          <div className="flex items-center justify-between mt-auto pt-1 text-[10px] text-[var(--t2)]">
            <span>{item.ocr_date || new Date(item.takenAt).toLocaleDateString()}</span>
            <span>{(item.fileSizeBytes / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Simple internal check icon to avoid full import in this scope
const Check = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"></polyline></svg>
);

export default function DocumentsPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, item: any} | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { setMedia } = useMediaStore();

  // Simple debounce for search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Click outside context menu to close
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['documents', filter, debouncedSearch],
    queryFn: async () => {
      const res = await apiClient.get('/explore/documents', {
        params: { filter, q: debouncedSearch, limit: 100 } // keeping limit reasonable for single page view
      });
      return res.data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const exportAllMutation = useMutation({
    mutationFn: async () => {
      // In a real app we'd initiate a blob download via fetch to get the ZIP directly
      // For this implementation we'll show a toast, but usually you do window.location.href = '/api/explore/documents/export-all'
      // Or we can use blob:
      const response = await apiClient.post('/explore/documents/export-all', {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fotowise-documents-${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onSuccess: () => {
      addToast('Documents exported as ZIP', 'success');
    },
    onError: () => {
      addToast('Failed to export documents', 'error');
    }
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/explore/documents/analyze');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      addToast('Finished scanning library for documents', 'success');
    }
  });

  const changeTypeMutation = useMutation({
    mutationFn: async ({ id, type, isDocument }: { id: string, type?: string, isDocument?: boolean }) => {
      const res = await apiClient.patch(`/explore/documents/${id}`, { documentType: type, isDocument });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  const ocrMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/explore/documents/${id}/ocr`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      addToast('OCR scan complete', 'success');
    },
    onError: () => {
      addToast('OCR scan failed', 'error');
    }
  });

  const handleContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, item });
  };

  const handleDownloadOriginal = (id: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `/api/explore/documents/${id}/export`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const stats = data?.counts || { idPassport: 0, bills: 0, forms: 0, certificates: 0, other: 0 };
  const items = data?.items || [];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-8 relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/explore')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-[var(--t2)] hover:text-[var(--t1)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--t1)] font-syne">Documents</h1>
          <span className="px-3 py-1 bg-[#5590f0]/10 text-[#5590f0] rounded-full text-xs font-bold border border-[#5590f0]/20">
            {data?.total || 0} items
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => scanMutation.mutate()} isLoading={scanMutation.isPending}>
            <RefreshCw size={14} className="mr-2" />
            Rescan
          </Button>
          <Button variant="ghost" onClick={() => exportAllMutation.mutate()} isLoading={exportAllMutation.isPending}>
            <Download size={14} className="mr-2" />
            Export All as ZIP
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Total Docs</p>
          <p className="text-2xl font-bold text-[var(--t1)]">{data?.total || 0}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">IDs & Passports</p>
          <p className="text-2xl font-bold text-[#22c982]">{stats.idPassport}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Financial</p>
          <p className="text-2xl font-bold text-[#5590f0]">{stats.bills}</p>
        </div>
        <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
          <p className="text-[var(--t2)] text-xs font-medium uppercase tracking-wider mb-1">Certificates</p>
          <p className="text-2xl font-bold text-[#d870a0]">{stats.certificates}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t2)]" />
          <input
            type="text"
            placeholder="Search filenames..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-full py-2 pl-9 pr-4 text-sm text-[var(--t1)] outline-none focus:border-[var(--accent-green)]/50 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto">
          {['all', 'id_passport', 'bills', 'forms', 'certificates'].map(f => {
            const label = f === 'all' ? 'All' 
                        : f === 'id_passport' ? 'ID & Passport'
                        : f === 'bills' ? 'Bills & Receipts'
                        : f === 'forms' ? 'Forms'
                        : 'Certificates';
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === f ? 'bg-white/10 text-white' : 'bg-transparent border border-[var(--border)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
         <div className="p-8 text-[var(--t2)] text-sm">Loading documents...</div>
      ) : isError ? (
         <div className="p-8 text-red-400 text-sm">Failed to load documents.</div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[var(--t2)]">
          <div className="w-24 h-24 mb-6 opacity-20 bg-[var(--bg-elevated)] border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center">
            <FileText size={40} className="opacity-50" />
          </div>
          <h2 className="text-xl font-bold text-[var(--t1)] mb-2 font-syne">No documents found</h2>
          <p className="text-sm">We couldn't find any documents matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 pb-24">
          {items.map((item: any) => (
            <DocumentCard 
              key={item.id} 
              item={item} 
              onContextMenu={handleContextMenu}
              onClick={() => {
                setMedia(items);
                navigate(`/media/${item.id}`);
              }}
            />
          ))}
        </div>
      )}

      {/* Custom Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 min-w-48 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-2xl py-1 transform originate-top-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
              <p className="text-xs font-semibold text-[var(--t1)] truncate max-w-[150px]">{contextMenu.item.filename}</p>
            </div>
            
            <button 
              className="w-full text-left px-3 py-2 text-sm text-[var(--t1)] hover:bg-[var(--accent-green)]/10 hover:text-[var(--accent-green)] transition-colors flex items-center"
              onClick={() => {
                navigate(`/media/${contextMenu.item.id}`);
                setContextMenu(null);
              }}
            >
              Open Full Size
            </button>
            <button 
              className="w-full text-left px-3 py-2 text-sm text-[var(--t1)] hover:bg-[var(--accent-green)]/10 hover:text-[var(--accent-green)] transition-colors flex items-center"
              onClick={() => {
                handleDownloadOriginal(contextMenu.item.id, contextMenu.item.filename);
                setContextMenu(null);
              }}
            >
              Download Original
            </button>
            <button 
              className="w-full text-left px-3 py-2 text-sm text-[var(--t1)] hover:bg-[var(--accent-green)]/10 hover:text-[var(--accent-green)] transition-colors flex items-center"
              onClick={() => {
                ocrMutation.mutate(contextMenu.item.id);
                setContextMenu(null);
              }}
            >
              Run OCR Scan
            </button>
            
            <div className="my-1 border-t border-[var(--border)]"></div>
            
            <div className="px-3 py-1 text-[10px] font-bold text-[var(--t2)] uppercase tracking-wider">Change Type</div>
            <div className="max-h-32 overflow-y-auto hide-scrollbar">
              {['passport', 'id_card', 'bill', 'receipt', 'form', 'certificate', 'contract'].map(type => (
                <button 
                  key={type}
                  className={`w-full text-left px-4 py-1.5 text-xs transition-colors flex items-center ${
                    contextMenu.item.documentType === type ? 'text-[var(--accent-green)] bg-[var(--accent-green)]/10' : 'text-[var(--t2)] hover:bg-white/5 hover:text-[var(--t1)]'
                  }`}
                  onClick={() => {
                    changeTypeMutation.mutate({ id: contextMenu.item.id, type });
                    setContextMenu(null);
                  }}
                >
                  {type.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>

            <div className="my-1 border-t border-[var(--border)]"></div>
            
            <button 
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center"
              onClick={() => {
                changeTypeMutation.mutate({ id: contextMenu.item.id, isDocument: false });
                addToast('Removed from documents', 'success');
                setContextMenu(null);
              }}
            >
              <AlertCircle size={14} className="mr-2" />
              Not a document
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
