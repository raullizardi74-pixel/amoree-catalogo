import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Zap, Target, Minus, Plus, ChevronDown, Search, X, 
  TrendingUp, Eye, EyeOff, AlertTriangle, Calculator, Package, ArrowRight 
} from 'lucide-react';
import { format } from 'date-fns';

// 🎯 OBJETIVOS DE UTILIDAD POR CATEGORÍA
const OBJETIVOS_UTILIDAD: Record<string, number> = { 
  'Frutas': 0.40, 
  'Verduras': 0.30, 
  'Hojas y tallos': 0.42, 
  'Abarrotes': 0.30, 
  'Cremería': 0.22, 
  'Otros': 0.15 
};

const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [coverageDays, setCoverageDays] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  // Registro de lo que Hugo está comprando en este momento
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
      
      // Semáforo Inteligente (Kg vs Pza)
      let urg = 3;
      if (p.stock_actual <= 0) urg = 0;
      else {
        const esKilo = p.unidad?.toLowerCase().includes('kg');
        const umbral = esKilo ? 1.5 : 5;
        if (p.stock_actual <= umbral) urg = 1;
        else if (dias < 1.5) urg = 2;
      }
      
      return { ...p, sug: Number(sug.toFixed(1)), urg, dias, mgn: OBJETIVOS_UTILIDAD[p.categoria] || 0.15 };
    });
  }, [products, salesData, coverageDays]);

  const categoriesOrdered = useMemo(() => {
    const cats = Array.from(new Set(analysis.map(p => p.categoria || 'Otros')));
    return cats.sort((a, b) => {
      const itemsA = analysis.filter(p => p.categoria === a && p.activo !== false);
      const itemsB = analysis.filter(p => p.categoria === b && p.activo !== false);
      const minA = itemsA.length > 0 ? Math.min(...itemsA.map(p => p.urg)) : 3;
      const minB = itemsB.length > 0 ? Math.min(...itemsB.map(p => p.urg)) : 3;
      return minA - minB;
    });
  }, [analysis]);

  // ✅ MAGIA: Actualiza el registro y calcula el precio sugerido al vuelo
  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const cur = prev[sku] || { 
        cantidad: 0, 
        cost: itemRef?.costo || 0, 
        prev: itemRef?.precio_venta || 0, 
        mgn: OBJETIVOS_UTILIDAD[itemRef?.categoria] || 0.15 
      };
      let upd = { ...cur, [field]: value };
      
      // Si cambia el costo, recalculamos el precio sugerido
      if (field === 'cost') {
        upd.prev = redondearPrecio(upd.cost * (1 + upd.mgn));
      }
      return { ...prev, [sku]: upd };
    });
  };

  const ejecutarCompraMaestra = async () => {
    const items = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    if (items.length === 0) return alert("Hugo, no has marcado nada para comprar.");
    
    setIsSubmitting(true);
    try {
      const tot = items.reduce((a, [_, d]) => a + (d.cantidad * d.cost), 0);
      const { data: h } = await supabase.from('compras').insert({ 
        proveedor_id: 1, 
        folio: `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`, 
        total: tot 
      }).select().single();

      for (const [sku, d] of items) {
        const p = products.find(x => x.sku === sku);
        const sBase = Math.max(0, p.stock_actual || 0);
        const sTot = sBase + d.cantidad;
        const cProm = ((sBase * (p.costo || 0)) + (d.cantidad * d.cost)) / sTot;
        
        await supabase.from('compras_detalle').insert({ 
          compra_id: h.id, 
          nombre: p.nombre, 
          cantidad: d.cantidad, 
          costo_unitario: d.cost, 
          subtotal: d.cantidad * d.cost 
        });
        
        await supabase.from('productos').update({ 
          costo: Number(cProm.toFixed(2)), 
          precio_venta: d.prev, 
          stock_actual: sTot 
        }).eq('sku', sku);
      }
      alert("✅ Sincronización Exitosa. Inventario y Precios actualizados."); 
      onBack();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden animate-in fade-in">
      {/* HEADER TÁCTICO */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#050505]">
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl">
          <X size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">
            Ruta de <span className="text-green-500">Abasto Inteligente</span>
          </h2>
          <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.3em] mt-1 italic">Central de Abasto Helper</p>
        </div>
        <div className="bg-green-600/10 p-3 rounded-2xl border border-green-500/20">
          <Calculator className="text-green-500" size={20} />
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="p-4 bg-[#080808] border-b border-white/5 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16}/>
          <input 
            type="text" placeholder="BUSCAR ARTÍCULO..." value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-green-500 uppercase outline-none focus:border-green-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48 no-scrollbar">
        {categoriesOrdered.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat && (searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
          const itemsActivos = items.filter(i => i.activo !== false);
          if (items.length === 0) return null;

          const minUrg = itemsActivos.length > 0 ? Math.min(...itemsActivos.map(i => i.urg)) : 3;
          const colorCat = minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : minUrg === 2 ? 'bg-yellow-500' : 'bg-green-500';

          return (
            <div key={cat} className={`rounded-[35px] border transition-all ${expandedCategory === cat ? 'bg-[#0A0A0A] border-white/10' : 'border-white/5 opacity-80'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${colorCat} ${minUrg <= 1 && 'animate-pulse'}`}></div>
                  <h3 className="text-xs font-black uppercase tracking-widest">{cat}</h3>
                </div>
                <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCategory === cat ? 'rotate-180' : ''}`}/>
              </button>

              {expandedCategory === cat && (
                <div className="px-4 pb-8 space-y-6">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, cost: item.costo, prev: item.precio_venta, mgn: item.mgn };
                    const esKilo = item.unidad?.toLowerCase().includes('kg');
                    const esBajo = item.stock_actual <= (esKilo ? 1.5 : 5);
                    const cardColor = item.stock_actual <= 0 ? 'border-red-600/30 bg-red-600/[0.03]' : esBajo ? 'border-orange-500/30 bg-orange-500/[0.03]' : 'border-white/5 bg-white/[0.01]';
                    
                    // Alerta de precio: Si el costo que pone Hugo es mayor al que teníamos
                    const precioSube = data.cost > item.costo;

                    return (
                      <div key={item.sku} className={`p-6 rounded-[35px] border transition-all ${cardColor} ${item.activo === false && 'opacity-20 grayscale'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-[11px] font-black uppercase italic leading-tight">{item.nombre}</p>
                            <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase">Costo Actual: {formatCurrency(item.costo)}</p>
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${item.stock_actual <= 0 ? 'bg-red-600' : esBajo ? 'bg-orange-600 text-black' : 'bg-green-600/20 text-green-500'}`}>
                            {item.stock_actual} {item.unidad}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* CANTIDAD A COMPRAR */}
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5 relative">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2">Cantidad a Comprar ({item.unidad})</label>
                             <input 
                                type="number" value={data.cantidad || ''} 
                                onChange={(e) => updateRegistro(item.sku, 'cantidad', parseFloat(e.target.value), item)}
                                className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" 
                                placeholder={`Sug: ${item.sug}`}
                             />
                             {item.sug > 0 && !data.cantidad && <div className="absolute right-4 bottom-4 bg-green-500/10 text-green-500 text-[8px] px-2 py-1 rounded-full font-black animate-pulse">SUGERIDO</div>}
                          </div>

                          {/* COSTO EN LA CENTRAL */}
                          <div className={`p-4 rounded-2xl border transition-all ${precioSube ? 'bg-red-600/5 border-red-600/20' : 'bg-black/50 border-white/5'}`}>
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2 flex justify-between">
                               Nuevo Costo en Central {precioSube && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={8}/> MÁS CARO</span>}
                             </label>
                             <div className="flex items-center">
                               <span className="text-gray-600 font-black mr-1">$</span>
                               <input 
                                  type="number" value={data.cost} 
                                  onChange={(e) => updateRegistro(item.sku, 'cost', parseFloat(e.target.value), item)}
                                  className={`w-full bg-transparent text-2xl font-black outline-none ${precioSube ? 'text-red-500' : 'text-white'}`}
                               />
                             </div>
                          </div>
                        </div>

                        {/* ✅ HERRAMIENTA DE MARGEN EN TIEMPO REAL */}
                        {data.cantidad > 0 && (
                          <div className="mt-4 p-5 bg-white/[0.02] border border-white/5 rounded-3xl flex justify-between items-center animate-in slide-in-from-top duration-500">
                             <div>
                               <p className="text-[7px] text-gray-500 font-black uppercase mb-1 tracking-widest">Sugerencia de Venta ({Math.round(data.mgn * 100)}% Margen)</p>
                               <div className="flex items-center gap-3">
                                 <p className="text-xl font-black text-white">{formatCurrency(data.prev)}</p>
                                 <ArrowRight size={14} className="text-gray-700" />
                                 <p className="text-[10px] font-bold text-gray-400">Hugo, así mantienes tu utilidad.</p>
                               </div>
                             </div>
                             <TrendingUp className={precioSube ? 'text-red-500' : 'text-green-500'} size={24} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER DE ACCIÓN */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,1)] z-[60]">
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-4 px-2">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Inversión Ruta</p>
          <p className="text-2xl font-black text-white">
            {formatCurrency(Object.values(registroCompra).reduce((a, b) => a + (b.cantidad * b.cost || 0), 0))}
          </p>
        </div>
        <button 
          onClick={ejecutarCompraMaestra} 
          disabled={issubmitting} 
          className="w-full bg-green-600 hover:bg-green-500 h-16 rounded-[28px] text-black font-black uppercase text-xs tracking-[0.3em] active:scale-95 transition-all shadow-xl shadow-green-900/20"
        >
          {issubmitting ? 'Sincronizando...' : 'Finalizar Operación y Actualizar Precios'}
        </button>
      </div>
    </div>
  );
}
