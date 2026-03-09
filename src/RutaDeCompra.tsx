import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverageDays, setCoverageDays] = useState(3); // Por defecto comprar para 3 días
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Traer productos y stock actual
      const { data: prodData } = await supabase.from('productos').select('*').order('nombre');
      
      // 2. Traer ventas de los últimos 7 días para promediar
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: orderData } = await supabase
        .from('pedidos')
        .select('detalle_pedido')
        .eq('estado', 'Finalizado')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (prodData) setProducts(prodData);
      if (orderData) setSalesData(orderData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- MOTOR DE CÁLCULO TITANIUM ---
  const analysis = useMemo(() => {
    return products.map(p => {
      // Calcular promedio diario de ventas
      let totalVendido = 0;
      salesData.forEach(order => {
        const item = order.detalle_pedido?.find((i: any) => i.sku === p.sku);
        if (item) totalVendido += item.quantity;
      });

      const promedioDiario = totalVendido / 7;
      const diasRestantes = promedioDiario > 0 ? p.stock_actual / promedioDiario : 99;
      
      // Sugerido de compra: (Promedio * Cobertura deseada) - Stock Actual
      const sugerido = Math.max(0, (promedioDiario * coverageDays) - p.stock_actual);

      // Semáforo de Prioridad
      let prioridad: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      if (diasRestantes < 1.5) prioridad = 'ALTA';
      else if (diasRestantes < 3) prioridad = 'MEDIA';

      return {
        ...p,
        promedioDiario,
        diasRestantes,
        sugerido,
        prioridad
      };
    });
  }, [products, salesData, coverageDays]);

  // Agrupar por Categoría
  const categories = Array.from(new Set(products.map(p => p.categoria || 'Otros')));

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.4em]">Calculando Ruta...</div>;

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-6 bg-black border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="text-xl p-2 bg-white/5 rounded-xl">🔙</button>
        <div className="text-center">
          <h2 className="text-sm font-black uppercase tracking-tighter italic">Ruta de <span className="text-green-500">Abasto</span></h2>
          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Calculadora de Cobertura</p>
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* SELECTOR DE COBERTURA */}
      <div className="p-4 bg-[#0A0A0A] border-b border-white/5 flex items-center justify-between">
        <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest ml-2">Días a cubrir:</p>
        <div className="flex bg-black p-1 rounded-2xl border border-white/5">
          {[2, 3, 5, 7].map(d => (
            <button 
              key={d} 
              onClick={() => setCoverageDays(d)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${coverageDays === d ? 'bg-white text-black' : 'text-gray-500'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DE ACORDEONES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {categories.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const alertCount = items.filter(i => i.prioridad === 'ALTA').length;
          const isExpanded = expandedCategory === cat;

          return (
            <div key={cat} className="bg-[#0A0A0A] rounded-[30px] border border-white/5 overflow-hidden transition-all shadow-xl">
              {/* Gatillo del Acordeón */}
              <button 
                onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                className="w-full p-6 flex items-center justify-between active:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${alertCount > 0 ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
                  <h3 className="text-sm font-black uppercase italic tracking-widest">{cat}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {alertCount > 0 && <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full">{alertCount} URGENTE</span>}
                  <span className="text-gray-600">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Contenido del Acordeón */}
              {isExpanded && (
                <div className="px-4 pb-6 space-y-3 animate-in slide-in-from-top-2">
                  {items.sort((a, b) => a.diasRestantes - b.diasRestantes).map(item => (
                    <div key={item.sku} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black uppercase text-white mb-1 leading-none">{item.nombre}</p>
                          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Costo Actual: {formatCurrency(item.costo)}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-[7px] font-black uppercase ${
                          item.prioridad === 'ALTA' ? 'bg-red-500/20 text-red-500' : 
                          item.prioridad === 'MEDIA' ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'
                        }`}>
                          {item.prioridad}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                          <p className="text-[6px] text-gray-600 uppercase font-black mb-1">Existencia</p>
                          <p className="text-[10px] font-black">{item.stock_actual.toFixed(1)} {item.unidad}</p>
                        </div>
                        <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                          <p className="text-[6px] text-gray-600 uppercase font-black mb-1">Venta/Día</p>
                          <p className="text-[10px] font-black">{item.promedioDiario.toFixed(1)} {item.unidad}</p>
                        </div>
                        <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
                          <p className="text-[6px] text-gray-600 uppercase font-black mb-1">Días Stock</p>
                          <p className={`text-[10px] font-black ${item.diasRestantes < 1.5 ? 'text-red-500' : 'text-white'}`}>
                            {item.diasRestantes.toFixed(1)}d
                          </p>
                        </div>
                      </div>

                      {/* SUGERENCIA DE COMPRA TITANIUM */}
                      <div className={`p-3 rounded-xl flex items-center justify-between ${item.sugerido > 0 ? 'bg-green-600/10 border border-green-500/30' : 'bg-white/5 border border-white/10 opacity-40'}`}>
                        <p className="text-[8px] font-black uppercase tracking-widest text-green-500">Llevar sugerido:</p>
                        <p className="text-lg font-black text-white">{item.sugerido.toFixed(1)} <span className="text-[10px]">{item.unidad}</span></p>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER DE ESTADO */}
      <div className="p-6 bg-black border-t border-white/5 flex items-center gap-4 shadow-2xl">
        <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-green-900/20">🥑</div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest">Reporte Inteligente</p>
          <p className="text-[7px] font-bold text-gray-600 uppercase">Basado en comportamiento de los últimos 7 días</p>
        </div>
      </div>
    </div>
  );
}
