import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Zap, ChevronDown, Search, ClipboardList, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: p } = await supabase.from('productos').select('*');
        const { data: o } = await supabase.from('pedidos').select('detalle_pedido').eq('estado', 'Finalizado').gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
        if (p) setProducts(p);
        if (o) setSalesData(o);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const analysis = useMemo(() => {
    return products.map(p => {
      let v = 0;
      salesData.forEach(o => { 
        const items = Array.isArray(o.detalle_pedido) ? o.detalle_pedido : [];
        const i = items.find((x: any) => (x.sku || x.SKU) === p.sku); 
        if (i) v += (Number(i.quantity) || 0); 
      });
      const prom = v / 7;
      const stock = p.stock_actual || 0;
      const sug = Math.max(0, (prom * 3) - stock);
      
      // ✅ LÓGICA DE SEMÁFORO TITANIUM
      let urg = 3; // Verde (Ok)
      if (stock <= 0) urg = 0; // Rojo (Agotado)
      else if (stock <= 2) urg = 1; // Ámbar (Bajo)

      return { ...p, sug: Number(sug.toFixed(1)), urg };
    });
  }, [products, salesData]);

  const filteredAnalysis = useMemo(() => {
    return analysis.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [analysis, searchTerm]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <Zap className="text-green-500 animate-pulse" size={48}/>
    </div>
  );

  return (
    <div className="bg-[#050505] min-h-screen pb-40 font-sans text-white">
      {/* HEADER ALTO CONTRASTE */}
      <div className="p-6 bg-black border-b border-white/10 flex justify-between items-center sticky top-0 z-[70] backdrop-blur-xl">
        <div>
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Misión <span className="text-green-500">Central</span></h2>
          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em]">Guía de Abasto Inteligente</p>
        </div>
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl active:scale-90 border border-white/10"><X size={20}/></button>
      </div>

      {/* BUSCADOR DENTRO DE RUTA */}
      <div className="p-4 bg-black/50 border-b border-white/5">
        <div className="relative max-w-7xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
          <input 
            type="text" 
            placeholder="BUSCAR ARTÍCULO EN LISTA..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-green-500 uppercase outline-none focus:border-green-500 transition-all" 
          />
        </div>
      </div>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {Array.from(new Set(filteredAnalysis.map(p => p.categoria || 'Otros'))).map(cat => {
          const items = filteredAnalysis.filter(p => (p.categoria || 'Otros') === cat);
          if (items.length === 0) return null;

          return (
            <div key={cat} className="border border-white/5 rounded-[30px] overflow-hidden bg-[#0A0A0A]">
              <button 
                onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} 
                className="w-full p-6 flex justify-between items-center hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{cat}</span>
                <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCategory === cat ? 'rotate-180' : ''}`}/>
              </button>

              {expandedCategory === cat && (
                <div className="p-4 space-y-3 bg-black/30">
                  {items.map(item => (
                    <div key={item.sku} className="p-5 bg-white/[0.02] border border-white/5 rounded-[2rem] flex justify-between items-center hover:border-white/10 transition-all">
                      <div className="flex-1">
                        <p className="text-xs font-black uppercase text-white tracking-tight">{item.nombre}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[9px] text-gray-500 font-bold uppercase">Stock: {item.stock_actual} {item.unidad}</p>
                          {item.sug > 0 && (
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${item.urg === 0 ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>
                              Sug: +{item.sug}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ✅ SEMÁFORO DE 3 COLORES */}
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] ${
                          item.urg === 0 ? 'bg-red-500 shadow-red-500/50' : 
                          item.urg === 1 ? 'bg-orange-500 shadow-orange-500/50' : 
                          'bg-green-500 shadow-green-500/50'
                        }`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
