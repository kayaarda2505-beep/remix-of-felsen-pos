import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { X, Camera, Keyboard, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStarting(true);
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back =
          devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          devices[0]?.deviceId;
        if (!back) throw new Error("Keine Kamera gefunden");
        const controls = await reader.decodeFromVideoDevice(
          back,
          videoRef.current!,
          (result, _err, ctrl) => {
            if (result && !cancelled) {
              ctrl.stop();
              onDetected(result.getText());
            }
          },
        );
        controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message ?? "Kamera konnte nicht gestartet werden");
      } finally {
        setStarting(false);
      }
    })();

    // Auto-focus manual field for USB/Bluetooth scanners
    setTimeout(() => inputRef.current?.focus(), 100);

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass rounded-3xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Barcode scannen</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-warning">
              {error}
            </div>
          )}
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-accent/70 shadow-[0_0_12px_var(--accent)] pointer-events-none" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = manual.trim();
            if (v) onDetected(v);
          }}
          className="p-4 flex items-center gap-2 border-t border-white/10"
        >
          <Keyboard className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="USB-Scanner oder Code manuell …"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
          />
          <button type="submit" className="rounded-lg bg-accent/20 hover:bg-accent/30 px-3 py-2 text-sm">
            OK
          </button>
        </form>
      </div>
    </div>
  );
}
