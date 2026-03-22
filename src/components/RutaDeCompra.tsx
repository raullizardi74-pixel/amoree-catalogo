import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Zap, Target, Minus, Plus, ChevronDown, Clock, Search, X, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

const OBJETIVOS_UTILIDAD: Record<string, number> = { 'Frutas': 0.40, 'Verduras': 0.30, 'Hojas y tallos': 0.42, 'Abarrotes': 0.30, 'Cremería': 0.22, 'Otros': 0.15 };
const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [coverageDays, setCoverageDays] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('productos').select('*');
      const { data: o } = await supabase.from('pedidos').select('detalle_pedido').eq('estado', 'Finalizado').gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
      if (p) setProducts(p);
      if (o) setSalesData(o);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const analysis = useMemo(() => {
    return products.map(p => {
      let v = 0;
      salesData.forEach(o => { const i = o.detalle_pedido?.find((x: any) => (x.sku || x.SKU) === p.sku); if (i) v += (i.quantity || 0); });
      const prom = v / 7;
      const dias = prom > 0 ? p.stock_actual / prom : 99;
      const sug = Math.max(0, (prom * coverageDays) - p.stock_actual);
      
      // ✅ Lógica de Urgencia Unificada
      let urg = 3;
      if (p.stock_actual <= 0) urg = 0; // Rojo
      else if (p.stock_actual <= 5) urg = 1; // Naranja
      else if (dias < 1.5) urg = 2; // Amarillo
      
      return { ...p, sug: Number(sug.toFixed(1)), urg, dias, mgn: OBJETIVOS_UTILIDAD[p.categoria] || 0.15 };
    });
  }, [products, salesData, coverageDays]);

  const categoriesOrdered = useMemo(() => {
    const cats = Array.from(new Set(analysis.map(p => p.categoria || 'Otros')));
    return cats.sort((a, b) => {
      // ✅ SEMÁFORO UNIFICADO: Ignora inactivos y busca el peor caso activo
      const itemsA = analysis.filter(p => p.categoria === a && p.activo !== false);
      const itemsB = analysis.filter(p => p.categoria === b && p.activo !== false);
      const minA = itemsA.length > 0 ? Math.min(...itemsA.map(p => p.urg)) : 3;
      const minB = itemsB.length > 0 ? Math.min(...itemsB.map(p => p.urg)) : 3;
      return minA - minB;
    });
  }, [analysis]);

  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const cur = prev[sku] || { cantidad: 0, cost: itemRef?.costo || 0, prev: itemRef?.precio_venta || 0, mgn: itemRef?.mgn || 0.15 };
      let upd = { ...cur, [field]: value };
      if (field === 'cost' || field === 'mgn') upd.prev = redondearPrecio(upd.cost * (1 + upd.mgn));
      return { ...prev, [sku]: upd };
    });
  };

  const toggleActivo = async (sku: string, act: any) => {
    const n = !(act === false ? false : true);
    await supabase.from('productos').update({ activo: n }).eq('sku', sku);
    setProducts(prev => prev.map(p => p.sku === sku ? { ...p, activo: n } : p));
  };

  const ejecutarCompraMaestra = async () => {
    const items = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    if (items.length === 0) return alert("Socio, no hay compras marcadas.");
    if (items.some(([_, d]) => (d.cost || 0) <= 0)) return alert("⚠️ Error: Costos en $0 detectados.");
    
    setIsSubmitting(true);
    try {
      const tot = items.reduce((a, [_, d]) => a + (d.cantidad * d.cost), 0);
      const { data: h } = await supabase.from('compras').insert({ proveedor_id: 1, folio: `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`, total: tot }).select().single();
      for (const [sku, d] of items) {
        const p = products.find(x => x.sku === sku);
        const sBase = Math.max(0, p.stock_actual || 0);
        const sTot = sBase + d.cantidad;
        const cProm = ((sBase * (p.costo || 0)) + (d.cantidad * d.cost)) / sTot;
        await supabase.from('compras_detalle').insert({ compra_id: h.id, nombre: p.nombre, cantidad: d.cantidad, costo_unitario: d.cost, subtotal: d.cantidad * d.cost });
        await supabase.from('productos').update({ costo: Number(cProm.toFixed(2)), precio_venta: d.prev, stock_actual: sTot }).eq('sku', sku);
      }
      alert("✅ Sincronizado."); onBack();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">Atrás</button>
        <div className="text-center"><h2 className="text-xs font-black uppercase italic tracking-tighter">Hugo <span className="text-green-500">Master</span></h2></div>
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-black font-black text-[10px]">🛒</div>
      </div>
      <div className="p-3 bg-[#050505] border-b border-white/10 flex items-center gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14}/><input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-[10px] font-bold text-green-500 outline-none"/></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48 no-scrollbar">
        {categoriesOrdered.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat && (searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
          const itemsActivos = items.filter(i => i.activo !== false);
          const minUrg = itemsActivos.length > 0 ? Math.min(...itemsActivos.map(i => i.urg)) : 3;
          const colorCat = minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : minUrg === 2 ? 'bg-yellow-500' : 'bg-green-500';
          if (items.length === 0) return null;

          return (
            <div key={cat} className={`rounded-[30px] border transition-all ${expandedCategory === cat ? 'bg-[#080808] border-white/10' : 'border-white/5 opacity-80'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${colorCat} ${minUrg <= 1 && 'animate-pulse'}`}></div><h3 className="text-[10px] font-black uppercase tracking-widest">{cat} ({itemsActivos.length} Activos)</h3></div>
                <ChevronDown size={14} className={expandedCategory === cat ? 'rotate-180' : ''}/>
              </button>
              {expandedCategory === cat && (
                <div className="px-3 pb-6 space-y-4">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, cost: item.costo, prev: item.precio_venta, mgn: item.mgn };
                    const esBajo = item.stock_actual <= 5;
                    const cardColor = item.stock_actual <= 0 ? 'border-red-600/40 bg-red-600/[0.04]' : esBajo ? 'border-orange-500/40 bg-orange-500/[0.04]' : 'border-white/5 bg-white/[0.02]';
                    return (
                      <div key={item.sku} className={`p-5 rounded-[28px] border ${cardColor} ${item.activo === false && 'opacity-30 grayscale'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2"><p className="text-[11px] font-black uppercase text-white leading-tight">{item.nombre}</p><button onClick={() => toggleActivo(item.sku, item.activo)}>{item.activo !== false ? <Eye size={10} className="text-green-500"/> : <EyeOff size={10} className="text-red-500"/>}</button></div>
                          <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${item.stock_actual <= 0 ? 'bg-red-600' : 'bg-green-500/20 text-green-500'}`}>{item.stock_actual} {item.unidad}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <input type="number" value={data.cantidad || ''} onChange={(e) => updateRegistro(item.sku, 'cantidad', parseFloat(e.target.value), item)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xl font-black text-green-500 outline-none" placeholder={`Sug: ${item.sug}`}/>
                          <input type="number" value={data.cost} onChange={(e) => updateRegistro(item.sku, 'cost', parseFloat(e.target.value), item)} className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xl font-black text-white outline-none"/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10"><button onClick={ejecutarCompraMaestra} disabled={issubmitting} className="w-full bg-green-600 h-16 rounded-[24px] text-black font-black uppercase text-xs">{issubmitting ? 'Sincronizando...' : 'Finalizar Operación'}</button></div>
    </div>
  );
}
