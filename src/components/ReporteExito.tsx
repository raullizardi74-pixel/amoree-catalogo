import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  startOfDay, endOfDay, subDays, format, parseISO 
} from 'date-fns';
import { 
  TrendingDown, TrendingUp, BarChart3, 
  Copy, FileText, CheckCircle2, Download, Calendar, Clock, ChevronDown
} from 'lucide-react';

const OBJETIVOS_UTILIDAD: Record<string, number> = {
  'Frutas': 0.40, 'Verduras': 0.30, 'Hojas y tallos': 0.42, 
  'Abarrotes': 0.30, 'Cremería': 0.22, 'Otros': 0.15
};

const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function ReporteExito({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // --- ESTADOS DE CALENDARIO ---
  const [rango, setRango] = useState<'hoy' | '7d' | '30d' | 'custom'>('hoy');
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchAnalisis(); }, [rango, fechaInicio, fechaFin]);

  const fetchAnalisis = async () => {
    setLoading(true);
    const ahora = new Date();
    let inicio: string, fin: string;

    if (rango === 'hoy') {
      inicio = startOfDay(ahora).toISOString();
      fin = endOfDay(ahora).toISOString();
    } else if (rango === '7d') {
      inicio = startOfDay(subDays(ahora, 7)).toISOString();
      fin = endOfDay(ahora).toISOString();
    } else if (rango === '30d') {
      inicio = startOfDay(subDays(ahora, 30)).toISOString();
      fin = endOfDay(ahora).toISOString();
    } else {
      inicio = startOfDay(parseISO(fechaInicio)).toISOString();
      fin = endOfDay(parseISO(fechaFin)).toISOString();
    }

    const { data: res } = await supabase
      .from('vista_analisis_compras')
      .select('*')
      .gte('created_at', inicio)
      .lte('created_at', fin)
      .order('created_at', { ascending: false });
    
    if (res) setData(res);
    setLoading(false);
  };

  const inversionTotal = data.reduce((acc, curr) => acc + (curr.costo_hoy * curr.cantidad), 0);
  const impactoNeto = data.reduce((acc, curr) => acc + curr.impacto_financiero_total, 0);
  const ahorros = data.filter(i => i.impacto_financiero_total < 0);
  const incrementos = data.filter(i => i.impacto_financiero_total > 0);

  const exportarPDF = () => {
    const doc = new jsPDF();
    const fechaReporte = rango === 'hoy' ? format(new Date(), 'dd/MM/yyyy') : `${fechaInicio} a ${fechaFin}`;
    doc.setFontSize(20);
    doc.setTextColor(0, 168, 107);
    doc.text('AUTOMATIZA CON RAÚL', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`AUDITORÍA DE ÉXITO - PERIODO: ${fechaReporte}`, 14, 30);
    doc.line(14, 32, 196, 32);

    const tableRows = data.map(item => [
      item.nombre_producto,
      formatCurrency(item.costo_anterior),
      formatCurrency(item.costo_hoy),
      `${item.variacion_porcentual.toFixed(1)}%`,
      formatCurrency(item.precio_venta_nuevo || 0)
    ]);

    (doc as any).autoTable({
      startY: 40,
      head: [['Producto', 'C. Anterior', 'C. Hoy', 'Var %', 'Venta Real']],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0] },
    });
    doc.save(`Auditoria_Raul_${format(new Date(), 'ddMMyy')}.pdf`);
  };

  const generarTextoNotebook = () => {
    let texto = `REPORTE DE AUDITORÍA ESTRATÉGICA - AMOREE\n`;
    texto += `PERIODO: ${rango === 'hoy' ? format(new Date(), 'dd/MM/yyyy') : `${fechaInicio} - ${fechaFin}`}\n`;
    texto += `INVERSIÓN TOTAL ANALIZADA: ${formatCurrency(inversionTotal)}\n`;
    texto += `IMPACTO FINANCIERO: ${impactoNeto <= 0 ? 'AHORRO' : 'SOBRECOSTO'} DE ${formatCurrency(Math.abs(impactoNeto))}\n`;
    texto += `--------------------------------------------------\n\n`;

    data.forEach(item => {
      const margenObj = OBJETIVOS_UTILIDAD[item.categoria] || OBJETIVOS_UTILIDAD['Otros'];
      const precioSugerido = redondearPrecio(item.costo_hoy * (1 + margenObj));
      const precioReal = item.precio_venta_nuevo || 0;

      texto += `ARTÍCULO: ${item.nombre_producto}\n`;
      texto += `  COSTO: Ant ${formatCurrency(item.costo_anterior)} | Hoy ${formatCurrency(item.costo_hoy)} (${item.variacion_porcentual.toFixed(1)}%)\n`;
      texto += `  VENTA: Sugerida ${formatCurrency(precioSugerido)} | Real ${formatCurrency(precioReal)}\n`;
      if (precioReal > 0 && precioReal < precioSugerido) texto += `  ⚠️ ALERTA: Margen por debajo del ${(margenObj * 100)}%\n`;
      texto += `\n`;
    });

    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-4 bg-[#050505] border-b border-white/10 flex justify-between items-center shadow-2xl relative z-20">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest">Atrás</button>
        <div className="text-center">
          <h2 className="text-xs font-black italic text-green-500 uppercase tracking-tighter">Auditoría Raúl</h2>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 mx-auto mt-0.5 text-[8px] text-gray-400 font-bold uppercase tracking-widest"
          >
            <Calendar size={10}/> {rango} <ChevronDown size={10} className={showFilters ? 'rotate-180' : ''}/>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarPDF} className="p-2.5 bg-white/5 rounded-xl"><Download size={16} className="text-gray-400" /></button>
          <button onClick={generarTextoNotebook} className="bg-green-600 p-2.5 rounded-xl flex items-center gap-2 active:scale-90 transition-all">
            {copied ? <CheckCircle2 size={16} className="text-black"/> : <Copy size={16} className="text-black"/>}
            <span className="text-black font-black text-[8px] uppercase">NotebookLM</span>
          </button>
        </div>
      </div>

      {/* PANEL DE FILTROS (CALENDARIO) */}
      {showFilters && (
        <div className="bg-[#0A0A0A] border-b border-white/10 p-4 space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex bg-black p-1 rounded-xl gap-1">
            {['hoy', '7d', '30d', 'custom'].map(r => (
              <button key={r} onClick={() => setRango(r as any)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${rango === r ? 'bg-white text-black' : 'text-gray-500'}`}>{r}</button>
            ))}
          </div>
          {rango === 'custom' && (
            <div className="flex items-center gap-2 pb-2">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] font-black text-green-500" />
              <span className="text-gray-700">→</span>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] font-black text-green-500" />
            </div>
          )}
          <button onClick={() => setShowFilters(false)} className="w-full py-2 bg-white/5 rounded-lg text-[8px] font-black uppercase text-gray-400">Aplicar Filtro</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Consultando Archivos...</p>
          </div>
        ) : (
          <>
            {/* RESUMEN DE IMPACTO */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0A0A0A] p-5 rounded-[30px] border border-white/5">
                  <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Impacto Neto</p>
                  <p className={`text-2xl font-black ${impactoNeto <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(Math.abs(impactoNeto))}
                  </p>
                  <p className="text-[7px] font-bold text-gray-500 mt-1 uppercase">
                    {impactoNeto <= 0 ? 'Ahorro generado' : 'Pérdida por alza'}
                  </p>
              </div>
              <div className="bg-[#0A0A0A] p-5 rounded-[30px] border border-white/5 flex flex-col justify-center gap-2 text-right">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[8px] font-black text-green-500 uppercase">Éxitos</span>
                    <span className="text-xs font-bold">{ahorros.length}</span>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[8px] font-black text-red-500 uppercase">Sobrecostos</span>
                    <span className="text-xs font-bold">{incrementos.length}</span>
                  </div>
              </div>
            </div>

            {/* LISTA DE VARIACIONES */}
            <div className="space-y-3">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] pl-2">Desglose de Auditoría</h3>
              {data.length === 0 ? (
                <div className="p-10 text-center text-[10px] text-gray-600 font-bold uppercase">No hay registros en este periodo</div>
              ) : (
                data.map((item, idx) => {
                  const esExito = item.impacto_financiero_total <= 0;
                  return (
                    <div key={idx} className={`p-5 rounded-[28px] border ${esExito ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'} flex items-center justify-between shadow-lg`}>
                      <div className="w-1/2">
                        <p className="text-[10px] font-black uppercase text-white truncate">{item.nombre_producto}</p>
                        <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">
                          Venta: {formatCurrency(item.precio_venta_nuevo || 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center justify-end gap-1 font-black text-sm ${esExito ? 'text-green-500' : 'text-red-500'}`}>
                          {esExito ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}
                          {Math.abs(item.variacion_porcentual).toFixed(1)}%
                        </div>
                        <p className="text-[8px] font-bold text-white mt-1">
                          {esExito ? '-' : '+'}{formatCurrency(Math.abs(item.impacto_financiero_total))}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <div className="p-6 bg-black border-t border-white/5 flex justify-between items-center shadow-[0_-20px_50px_rgba(0,0,0,1)]">
        <div>
          <p className="text-[9px] font-black text-gray-500 uppercase">Inversión Analizada</p>
          <p className="text-xl font-black text-white leading-none">{formatCurrency(inversionTotal)}</p>
        </div>
        <p className="text-[9px] font-black text-green-500 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20 uppercase">
          {data.length} Transacciones
        </p>
      </div>

    </div>
  );
}
