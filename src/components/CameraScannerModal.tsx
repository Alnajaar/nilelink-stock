import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  ScanLine
} from 'lucide-react';
import { StockItem } from '../types/stock';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanItem: (item: StockItem) => void;
  items: StockItem[];
  title?: string;
  subtitle?: string;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanItem,
  items,
  title = 'Scan Item QR / Barcode',
  subtitle = 'Point camera at shelf label, container sticker, or packaging'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastScanned, setLastScanned] = useState<{ name: string; time: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);

  // Play audio beep using native Web Audio API
  const playBeep = useCallback(() => {
    if (soundEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz A5 beep
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        }
      } catch {
        // Audio autoplay policy
      }
    }
    // Haptic vibration feedback for mobile devices
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([40, 20, 40]);
      } catch {
        // Ignored
      }
    }
  }, [soundEnabled]);

  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Match scanned code against inventory items
  const handleCodeFound = useCallback(
    (code: string) => {
      const trimmed = code.trim().toLowerCase();
      if (!trimmed) return;

      const now = Date.now();
      // Debounce identical scans within 1.2 seconds to prevent accidental double-counts
      if (
        lastScannedCodeRef.current.code === trimmed &&
        now - lastScannedCodeRef.current.time < 1200
      ) {
        return;
      }
      lastScannedCodeRef.current = { code: trimmed, time: now };

      const matched = items.find(it => {
        const b = (it.barcode || '').toLowerCase();
        const s = (it.sku || '').toLowerCase();
        const id = it.id.toLowerCase();
        const name = it.name.toLowerCase();

        return b === trimmed || s === trimmed || id === trimmed || name === trimmed;
      });

      if (matched) {
        playBeep();
        setLastScanned({ name: matched.name, time: Date.now() });
        onScanItem(matched);

        if (!continuousMode) {
          onClose();
        }
      } else {
        setErrorMessage(`Scanned "${code}" — not in current inventory catalog.`);
        setTimeout(() => setErrorMessage(''), 3000);
      }
    },
    [items, onScanItem, playBeep, continuousMode, onClose]
  );

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    setErrorMessage('');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      setHasCameraPermission(false);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera permissions in your browser.'
          : 'Unable to start camera. You can still enter or search barcodes manually below.'
      );
    }
  }, [facingMode]);

  // Toggle Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchEnabled;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }]
      });
      setTorchEnabled(next);
    } catch {
      // Not supported
    }
  };

  // Continuous Scanner Loop with Native BarcodeDetector + jsQR fallback
  useEffect(() => {
    if (!isOpen) return;

    startCamera();

    let isScanning = true;
    let lastProcessedTime = 0;
    let nativeDetector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
        });
      } catch {
        nativeDetector = null;
      }
    }

    const scanFrame = async () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const now = Date.now();
        // Limit processing to ~12-15 fps to preserve battery and CPU
        if (now - lastProcessedTime > 75) {
          lastProcessedTime = now;

          let detected = false;
          // 1. Try Native BarcodeDetector first (GPU hardware accelerated on Android/Chrome)
          if (nativeDetector) {
            try {
              const barcodes = await nativeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleCodeFound(barcodes[0].rawValue);
                detected = true;
              }
            } catch {
              // fallback to canvas
            }
          }

          // 2. Fallback to jsQR canvas processing
          if (!detected) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
              });

              if (qrCode && qrCode.data) {
                handleCodeFound(qrCode.data);
              }
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [isOpen, startCamera, handleCodeFound]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              title={soundEnabled ? 'Mute beep' : 'Enable beep'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Viewfinder Container */}
        <div className="relative bg-black aspect-4/3 sm:aspect-square flex items-center justify-center overflow-hidden">
          {hasCameraPermission === false ? (
            <div className="p-6 text-center space-y-2 text-slate-400">
              <Camera className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs">{errorMessage || 'Camera offline or permission needed.'}</p>
              <button
                onClick={startCamera}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Graphic */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 relative rounded-2xl border-2 border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  {/* Glowing Laser Bar */}
                  <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce" />

                  {/* Corner Markers */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-400" />
                </div>
              </div>

              {/* Viewfinder Overlay Controls */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                      torchEnabled ? 'bg-amber-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
                    }`}
                    title="Toggle Flashlight"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
                  className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-all"
                  title="Flip camera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Last Scanned Feedback Banner */}
              {lastScanned && (
                <div className="absolute bottom-3 left-3 right-3 bg-emerald-500/90 backdrop-blur-md text-white py-2 px-3 rounded-xl flex items-center justify-between text-xs font-semibold animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">Added: {lastScanned.name}</span>
                  </div>
                  <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-md font-mono">Matched</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Manual Entry & Settings */}
        <div className="p-4 space-y-3 bg-slate-900">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (manualCode) {
                handleCodeFound(manualCode);
                setManualCode('');
              }
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Or type SKU / Barcode / Name..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors shrink-0"
            >
              Lookup
            </button>
          </form>

          {/* Quick Barcode Helper Pills for Testing */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 block font-medium">Quick Test Barcodes:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[11px]">
              {items.slice(0, 4).map(it => (
                <button
                  key={it.id}
                  onClick={() => handleCodeFound(it.barcode || it.id)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg whitespace-nowrap font-mono text-[10px]"
                >
                  {it.barcode || it.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={e => setContinuousMode(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Keep camera open for rapid scanning</span>
            </label>
            <button onClick={onClose} className="text-slate-400 hover:text-white font-semibold">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
