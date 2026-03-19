import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Zap } from 'lucide-react'; // Cambié Refresh por Zap para el flash

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export function Scanner({ onScanSuccess, onClose }: ScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 20, // Más rápido para que no haya lag
        qrbox: { width: 300, height: 150 }, // Rectángulo alargado ideal para CÓDIGOS DE BARRAS
        aspectRatio: 1.0
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText);
        scanner.clear();
        onClose();
      },
      () => {} // Ignoramos errores de lectura constante
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error al apagar cámara", err));
      }
    };
  }, [onScanSuccess, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-[40px] bg-[#0A0A0A] border border-white/10 shadow-2xl">
        
        {/* Header Titanium */}
        <div className="flex items-center justify-between border-b border-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-500/10 text-green-500">
              <Camera size={20} />
            </div>
            <h2 className="font-black uppercase italic tracking-tighter text-white">Escáner <span className="text-green-500">Amoree</span></h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-white/5 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-8">
          <div id="reader" className="overflow-hidden rounded-3xl border-2 border-green-500/20 bg-black"></div>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-4 rounded-3xl bg-green-500/5 p-5 text-[10px] font-black uppercase tracking-widest text-green-400 border border-green-500/10">
              <Zap size={16} className="text-green-500" />
              <p>Apunta al código de barras del producto.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black/50 p-6 text-center border-t border-white/5">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
            Amoree Business OS - Vision Module
          </p>
        </div>
      </div>
    </div>
  );
}
