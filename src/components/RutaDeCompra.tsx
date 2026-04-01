import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Zap, ChevronDown, Search, ClipboardList, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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
      const sug = Math.max(0, (prom * 3) - (p.stock_actual || 0));
      let urg = (p.stock_actual || 0) <= 0 ? 0 : (p.stock_actual <= 2 ? 1 : 3);
      return { ...p, sug: Number(sug.toFixed(1)), urg };
    });
  }, [products, salesData]);

  if (loading) return <div className="py-20 text-center animate-pulse"><Zap className="mx-auto text-green-500 mb-4" size={48}/><p className="text-[10px] font-black uppercase text-gray-400">Analizando Ruta...</p></div>;

  return (
    <div className="bg-white min-h-screen pb-40">
      <div className="p-6 bg-[#050505] text-white flex justify-between items-center shadow-xl">
        <h2 className="text-xl font-black uppercase italic italic">Misión <span className="text-green-500">Central</span></h2>
        <button onClick={onBack} className="bg-white/10 p-2 rounded-xl"><X size={20}/></button>
      </div>

      <div className="p-6 space-y-6">
        {Array.from(new Set(analysis.map(p => p.categoria || 'Otros'))).map(cat => (
          <div key={cat} className="border border-gray-100 rounded-[30px] overflow-hidden">
            <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-6 flex justify-between items-center bg-gray-50">
              <span className="text-[10px] font-black uppercase tracking-widest">{cat}</span>
              <ChevronDown size={16} className={expandedCategory === cat ? 'rotate-180' : ''}/>
            </button>
            {expandedCategory === cat && (
              <div className="p-4 space-y-4">
                {analysis.filter(p => (p.categoria || 'Otros') === cat).map(item => (
                  <div key={item.sku} className="p-4 bg-white border border-gray-50 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black uppercase">{item.nombre}</p>
                      <p className="text-[9px] text-red-500 font-bold">Sugerido: {item.sug} {item.unidad}</p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${item.urg === 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
