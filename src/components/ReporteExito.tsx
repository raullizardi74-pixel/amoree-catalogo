import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  TrendingDown, TrendingUp, BarChart3, 
  Copy, FileText, CheckCircle2, Download 
} from 'lucide-react';

// --- CONFIGURACIÓN MAESTRA DE MÁRGENES (ADN) ---
const OBJETIVOS_UTILIDAD: Record<string, number> = {
  'Frutas': 0.40,
  'Verduras': 0.30,
  'Hojas y tallos': 0.42,
  'Abarrotes': 0.30,
  'Cremería': 0.22,
  'Otros': 0.15
};

const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function ReporteExito({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchAnalisis(); }, []);

  const fetchAnalisis = async () => {
    setLoading(true);
    // IMPORTANTE: La columna ahora es created_at según el último cambio en SQL
    const { data: res } = await supabase
      .from('vista_analisis_compras')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (res) setData(res);
    setLoading(false);
  };

  const inversionTotal = data.reduce((acc, curr) => acc + (curr.costo_hoy * curr.cantidad), 0);
  const impactoNeto = data.reduce((acc, curr) => acc + curr.impacto_financiero_total, 0);
  const ahorros = data.filter(i => i.impacto_financiero_total < 0);
  const incrementos = data.filter(i => i.impacto_financiero_total > 0);

  // --- GENERADOR DE PDF "AUTOMATIZA CON RAÚL" ---
  const exportarPDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString();
    doc.setFontSize(20);
    doc.setTextColor(0, 168, 107);
    doc.text('AUTOMATIZA CON RAÚL', 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`REPORTE DE AUDITORÍA - ${fecha}`, 14, 30);
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
    doc.save(`Reporte_Amoree_${fecha}.pdf`);
  };

  // --- GENERADOR DE TEXTO PARA NOTEBOOK LM ---
  const generarTextoNotebook = () => {
    let texto = `REPORTE DE AUDITORÍA ESTRATÉGICA - AMOREE\n`;
    texto += `FECHA: ${new Date().toLocaleDateString()}\n`;
    texto += `INVERSIÓN TOTAL: ${formatCurrency(inversionTotal)}\n`;
    texto += `--------------------------------------------------\n\n`;

    data.forEach(item => {
      const margenObj = OBJETIVOS_UTILIDAD[item.categoria] || OBJETIVOS_UTILIDAD['Otros'];
      const precioSugeridoRaw = item.costo_hoy * (1 + margenObj);
      const precioSugerido = redondearPrecio(precioSugeridoRaw);
      const precioReal = item.precio_venta_nuevo || 0;
      const statusCosto = item.impacto_financiero_total <= 0 ? "AHORRO" : "SOBRECOSTO";

      texto += `ARTÍCULO: ${item.nombre_producto} (SKU: ${item.producto_sku})\n`;
      texto += `  CATEGORÍA: ${item.categoria || 'Otros'}\n`;
      texto += `  COSTO: Anterior ${formatCurrency(item.costo_anterior)} | Hoy ${formatCurrency(item.costo_hoy)}\n`;
      texto += `  VAR. COSTO: ${item.variacion_porcentual.toFixed(2)}% | Estatus: ${statusCosto}\n`;
      texto += `  VENTA: Sugerida ${formatCurrency(precioSugerido)} | Real Capturada ${formatCurrency(precioReal)}\n`;
      
      if (precioReal > 0 && precioReal < precioSugerido) {
        texto += `  ⚠️ ALERTA: Margen por debajo del objetivo del ${(margenObj * 100)}%\n`;
      }
      texto += `\n`;
    });

    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-widest">Sincronizando Inteligencia...</div>;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-6 bg-[#050505] border-b border-white/10 flex justify-between items-center shadow-2xl">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-bold uppercase">Volver</button>
        <div className="text-center">
          <h2 className="text-sm font-black italic text-green-500 uppercase tracking-tighter">Éxito en la Compra</h2>
          <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">Automatiza con Raúl</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarPDF} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
            <Download size={18} className="text-gray-400" />
          </button>
          <button 
            onClick={generarTextoNotebook}
            className="bg-green-600 p-3 rounded-2xl flex items-center gap-2 active:scale-90 transition-all shadow-lg"
          >
            {copied ? <CheckCircle2 size={18} className="text-black"/> : <Copy size={18} className="text-black"/>}
            <span className="text-black font-black text-[9px] uppercase tracking-widest text-center">NotebookLM</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        
        {/* RESUMEN DE IMPACTO */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0A0A0A] p-5 rounded-[30px] border border-white/5">
             <p className="text-[8px] font-black text-gray-400 uppercase mb-2">Impacto Neto Gestión</p>
             <p className={`text-2xl font-black ${impactoNeto <= 0 ? 'text-green-500' : 'text-red-500'}`}>
               {formatCurrency(Math.abs(impactoNeto))}
             </p>
             <p className="text-[7px] font-bold text-gray-500 mt-1 uppercase">
               {impactoNeto <= 0 ? 'Dinero ahorrado hoy' : 'Pérdida por inflación'}
             </p>
          </div>
          <div className="bg-[#0A0A0A] p-5 rounded-[30px] border border-white/5 flex flex-col justify-center gap-2">
             <div className="flex justify-between items-center">
               <span className="text-[8px] font-black text-green-500 uppercase">Ahorros</span>
               <span className="text-xs font-bold">{ahorros.length}</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-[8px] font-black text-red-500 uppercase">Fugas</span>
               <span className="text-xs font-bold">{incrementos.length}</span>
             </div>
          </div>
        </div>

        {/* LISTA DE VARIACIONES */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Desglose de Operación</h3>
          {data.map((item, idx) => {
            const esExito = item.impacto_financiero_total <= 0;
            return (
              <div key={idx} className={`p-5 rounded-[28px] border ${esExito ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'} flex items-center justify-between`}>
                <div>
                  <p className="text-xs font-black uppercase text-white truncate w-40">{item.nombre_producto}</p>
                  <p className="text-[8px] font-bold text-gray-500 uppercase mt-1">
                    Venta Real: {formatCurrency(item.precio_venta_nuevo || 0)}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`flex items-center justify-end gap-1 font-black text-sm ${esExito ? 'text-green-500' : 'text-red-500'}`}>
                    {esExito ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}
                    {Math.abs(item.variacion_porcentual).toFixed(1)}%
                  </div>
                  <p className="text-[9px] font-bold text-white mt-1">
                    {esExito ? '-' : '+'}{formatCurrency(Math.abs(item.impacto_financiero_total))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-black border-t border-white/5 flex justify-between items-center shadow-[0_-20px_50px_rgba(0,0,0,1)]">
        <div>
          <p className="text-[9px] font-black text-gray-500 uppercase">Inversión Final</p>
          <p className="text-xl font-black text-white leading-none">{formatCurrency(inversionTotal)}</p>
        </div>
        <p className="text-[10px] font-black text-green-500 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20 uppercase">
          {data.length} Productos
        </p>
      </div>

    </div>
  );
}
