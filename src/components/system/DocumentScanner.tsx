import React, { useState, useRef } from 'react';
import { Camera, Plus, Trash2, Sliders, FileText, X, RefreshCw, Image as ImageIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface DocumentScannerProps {
  onScanComplete: (pdfBlob: Blob, previewUrl: string) => void;
  onClose: () => void;
}

type FilterMode = 'original' | 'magic-color' | 'bw';

export default function DocumentScanner({ onScanComplete, onClose }: DocumentScannerProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('magic-color');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Smooth slide-down exit animation handler
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Matches the CSS animation duration
  };

  // Apply CamScanner-style filters using HTML5 Canvas
  const processImage = (imageSrc: string, mode: FilterMode): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(imageSrc);

        // Keep standard dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (mode === 'original') {
          return resolve(canvas.toDataURL('image/jpeg', 0.85));
        }

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Calculate Luminance
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          if (mode === 'bw') {
            const threshold = 140;
            const val = gray > threshold ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          } else if (mode === 'magic-color') {
            const contrast = 1.35; 
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            
            data[i] = Math.min(255, Math.max(0, factor * (r - 128) + 128 + 10));
            data[i + 1] = Math.min(255, Math.max(0, factor * (g - 128) + 128 + 10));
            data[i + 2] = Math.min(255, Math.max(0, factor * (b - 128) + 128 + 10));
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = imageSrc;
    });
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      const enhanced = await processImage(rawDataUrl, filterMode);
      setPages((prev) => [...prev, enhanced]);
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeletePage = (indexToRemove: number) => {
    setPages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleGeneratePDF = async () => {
    if (pages.length === 0) {
      toast.error('Please scan at least one page.');
      return;
    }

    setIsProcessing(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(pages[i], 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }

      const pdfBlob = pdf.output('blob');
      const previewUrl = URL.createObjectURL(pdfBlob);

      onScanComplete(pdfBlob, previewUrl);
      toast.success(`Generated ${pages.length}-page document PDF!`);
      handleCloseModal(); // Trigger the close animation after saving
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF document.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/80 backdrop-blur-sm ${isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade'}`}>
      <div className={`relative flex flex-col w-full max-w-2xl bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] border border-slate-100 ${isClosing ? 'animate-responsive-modal-close' : 'animate-responsive-modal'}`}>
        
        <canvas ref={canvasRef} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
               <Camera size={20} />
            </div>
            <div>
              <h3 className="font-black text-lg leading-tight">Document Scanner</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{pages.length} page(s) captured</p>
            </div>
          </div>
          <button onClick={handleCloseModal} className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors active:scale-95">
            <X size={20} />
          </button>
        </div>

        {/* Sleek Segmented Control Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200 gap-3">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Sliders size={14} /> Scan Filter
          </span>
          <div className="flex bg-slate-200/70 p-1 rounded-xl w-full sm:w-auto">
            {(['magic-color', 'bw', 'original'] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold capitalize transition-all duration-200 ${
                  filterMode === mode
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Body: Page Gallery / Queue */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50 min-h-[300px]">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-slate-300 rounded-[1.5rem] bg-white p-6 transition-colors hover:border-blue-400">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <ImageIcon size={32} strokeWidth={1.5} />
              </div>
              <h4 className="font-black text-slate-800 text-lg mb-1">No pages scanned yet</h4>
              <p className="text-sm text-slate-500 max-w-sm mb-6 font-medium">
                Use your device camera or upload a photo of the physical document to begin processing.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-all"
              >
                <Camera size={18} /> Scan First Page
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {pages.map((img, idx) => (
                <div key={idx} className="relative group bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm aspect-[3/4] flex flex-col transition-all hover:border-blue-400">
                  <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[11px] font-mono px-2 py-0.5 rounded-md backdrop-blur-md font-bold shadow-sm">
                    Page {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeletePage(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-lg shadow-sm backdrop-blur-md transition-all active:scale-95"
                    title="Remove Page"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/50 rounded-2xl flex flex-col items-center justify-center p-4 text-slate-500 hover:text-blue-600 transition-all aspect-[3/4] active:scale-[0.98]"
              >
                {isProcessing ? (
                  <RefreshCw size={28} className="animate-spin mb-2 text-blue-600" />
                ) : (
                  <Plus size={32} className="mb-2" />
                )}
                <span className="text-sm font-bold">{isProcessing ? 'Processing...' : 'Add Next Page'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Updated Footer Actions: Cancel and Save Only */}
        <div className="flex p-5 bg-white border-t-2 border-slate-100 shrink-0">
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 px-6 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm active:scale-95 transition-all h-12"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={pages.length === 0 || isProcessing}
              className="flex-[2] px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all h-12"
            >
              <FileText size={18} /> Save ({pages.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}