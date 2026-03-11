import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  TrendingDown, TrendingUp, BarChart3, 
  Copy, FileText, CheckCircle2, AlertCircle 
} from 'lucide-react';

export default function ReporteExito({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchAnalisis(); }, []);

  const fetchAnalisis = async () => {
    setLoading(true);
    // Consultamos la vista inteligente que creamos en el paso anterior
    const { data: res } = await supabase
      .from('vista_analisis_compras')
      .select('*')
      .order('fecha_compra', { ascending: false })
      .limit(50);
    
    if (res) setData(res);
    setLoading(false);
  };

  // --- LÓGICA DE RESUMEN ---
  const inversionTotal = data.reduce((acc, curr) => acc + (curr.costo_hoy * curr.cantidad), 0);
  const impactoNeto = data.reduce((acc, curr) => acc + curr.impacto_financiero_total, 0);
  const ahorros = data.filter(i => i.impacto_financiero_total < 0);
  const incrementos = data.filter(i => i.impacto_financiero_total > 0);

  // --- GENERADOR DE TEXTO PARA NOTEBOOK LM ---
  const generarTextoNotebook = () => {
    let texto = `REPORTE DE ÉXITO DE COMPRA - AUTOMATIZA CON RAÚL\n`;
    texto += `FECHA: ${new Date().toLocaleDateString()}\n`;
    texto += `INVERSIÓN TOTAL: ${formatCurrency(inversionTotal)}\n`;
    texto += `IMPACTO NETO EN UTILIDAD: ${formatCurrency(impactoNeto * -1)} (Ahorro positivo si es mayor a 0)\n`;
    texto += `--------------------------------------------------\n`;
    texto += `DETALLE DE ARTÍCULOS (COSTO HOY VS ANTERIOR):\n`;
    
    data.forEach(item => {
      const status = item.impacto_financiero_total <= 0 ? "AHORRO" : "INCREMENTO";
      texto += `- ${item.nombre_producto} (SKU: ${item.producto_sku}):\n`;
      texto += `  Costo Anterior: ${formatCurrency(item.costo_anterior)} | Costo Hoy: ${formatCurrency(item.costo_hoy)}\n`;
      texto += `  Variación: ${item.variacion_porcentual.toFixed(2)}% | Impacto: ${formatCurrency(item.impacto_financiero_total * -1)}\n`;
      texto += `  Estatus: ${status}\n\n`;
    });

    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-widest">Generando Inteligencia de Compra...</div>;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white overflow-hidden">
      
      {/* HEADER CONSULTOR */}
      <div className="p-6 bg-[#050505] border-b border-white/10 flex justify-between items-center shadow-2xl">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-bold">CERRAR</button>
        <div className="text-center">
          <h2 className="text-sm font-black italic text-green-500 uppercase tracking-tighter">Reporte de Éxito</h2>
          <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest">Consultoría: Automatiza con Raúl</p>
        </div>
        <button 
          onClick={generarTextoNotebook}
          className="bg-green-600 p-3 rounded-2xl flex items-center gap-2 active:scale-90 transition-all shadow-lg shadow-green-900/40"
        >
          {copied ? <CheckCircle2 size={18} className="text-black"/> : <Copy size={18} className="text-black"/>}
          <span className="text-black font-black text-[9px] uppercase tracking-widest">NotebookLM</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        
        {/* CARDS DE IMPACTO TÁCTICO */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111] p-5 rounded-[30px] border border-white/5">
             <p className="text-[8px] font-black text-gray-500 uppercase mb-2">Impacto Neto Hoy</p>
             <p className={`text-2xl font-black ${impactoNeto <= 0 ? 'text-green-500' : 'text-red-500'}`}>
               {formatCurrency(Math.abs(impactoNeto))}
             </p>
             <p className="text-[7px] font-bold text-gray-400 mt-1 uppercase">
               {impactoNeto <= 0 ? 'Dinero ahorrado en compra' : 'Sobrecosto absorbido'}
             </p>
          </div>
          <div className="bg-[#111] p-5 rounded-[30px] border border-white/5 flex flex-col justify-center">
             <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 rounded-full bg-green-500"></div>
               <p className="text-[8px] font-black text-gray-500 uppercase italic">Héroes: {ahorros.length}</p>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-red-500"></div>
               <p className="text-[8px] font-black text-gray-500 uppercase italic">Fugas: {incrementos.length}</p>
             </div>
          </div>
        </div>

        {/* LISTA DETALLADA POR IMPACTO */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2 flex items-center gap-2">
            <BarChart3 size={12}/> Desglose de Variaciones
          </h3>
          
          {data.map((item, idx) => {
            const esExito = item.impacto_financiero_total <= 0;
            return (
              <div key={idx} className={`p-5 rounded-[28px] border ${esExito ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'} flex items-center justify-between`}>
                <div className="w-1/2">
                  <p className="text-xs font-black uppercase text-white truncate">{item.nombre_producto}</p>
                  <p className="text-[8px] font-bold text-gray-500 uppercase mt-1">Costo: {formatCurrency(item.costo_anterior)} ➔ {formatCurrency(item.costo_hoy)}</p>
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

      {/* FOOTER - RESUMEN DE COMPRA TOTAL */}
      <div className="p-6 bg-black border-t border-white/5 flex justify-between items-center">
        <div>
          <p className="text-[9px] font-black text-gray-500 uppercase">Inversión Finalizada</p>
          <p className="text-xl font-black text-white">{formatCurrency(inversionTotal)}</p>
        </div>
        <div className="flex gap-2">
           <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
             <p className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Items</p>
             <p className="text-sm font-black text-white">{data.length}</p>
           </div>
        </div>
      </div>

    </div>
  );
}
