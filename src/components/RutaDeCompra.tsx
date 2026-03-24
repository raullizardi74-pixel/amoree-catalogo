import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Zap, ChevronDown, Search, Eye, EyeOff, AlertTriangle, 
  Calculator, ClipboardList, CheckCircle2, X, ArrowRight, TrendingUp, Save, ShoppingCart
} from 'lucide-react';
import { format } from 'date-fns';

const OBJETIVOS_UTILIDAD: Record<string, number> = { 
  'Frutas': 0.40, 'Verduras': 0.30, 'Hojas y tallos': 0.42, 'Abarrotes': 0.30, 'Cremería': 0.22, 'Otros': 0.15 
};
const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false); 
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('productos').select('*');
      const { data: o } = await supabase.from('pedidos')
        .select('detalle_pedido')
        .eq('estado', 'Finalizado')
        .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
      
      if (p) setProducts(p);
      if (o) setSalesData(o);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

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
      
      let urg = 3;
      if ((p.stock_actual || 0) <= 0) urg = 0; 
      else {
        const esKilo = p.unidad?.toLowerCase().includes('kg');
        if ((p.stock_actual || 0) <= (esKilo ? 1.5 : 5)) urg = 1; 
      }
      return { ...p, sug: Number(sug.toFixed(1)), urg, presupuesto: sug * (p.costo || 0) };
    });
  }, [products, salesData]);

  const resumenMision = useMemo(() => {
    const itemsFaltantes = analysis.filter(p => p.urg < 3 && p.activo !== false);
    const dineroNecesario = itemsFaltantes.reduce((acc, curr) => acc + curr.presupuesto, 0);
    return { count: itemsFaltantes.length, dinero: dineroNecesario };
  }, [analysis]);

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

  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const cur = prev[sku] || { 
        cantidad: 0, 
        cost: itemRef?.costo || 0, 
        prev: itemRef?.precio_venta || 0, 
        mgn: OBJETIVOS_UTILIDAD[itemRef?.categoria] || 0.15, 
        nombre: itemRef?.nombre,
        id: itemRef?.id
      };
      let upd = { ...cur, [field]: value };
      if (field === 'cost') upd.prev = redondearPrecio(parseFloat(value || 0) * (1 + upd.mgn));
      return { ...prev, [sku]: upd };
    });
  };

  const ejecutarCompraMaestra = async () => {
    const items = Object.entries(registroCompra).filter(([_, val]) => Number(val.cantidad) > 0);
    if (items.length === 0) return alert("Socio, no hay productos en el carrito.");
    
    setIsSubmitting(true);
    try {
      const totalNota = items.reduce((a, [_, d]) => a + (Number(d.cantidad) * Number(d.cost) || 0), 0);
      
      const { data: compraHeader, error: errH } = await supabase.from('compras').insert({ 
        proveedor_id: 1, 
        proveedor: 'ABASTO CENTRAL',
        folio: `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`, 
        total: totalNota,
        total_compra: totalNota,
        metodo_pago: 'Efectivo'
      }).select().single();

      if (errH) throw errH;

      for (const [sku, d] of items) {
        const p = products.find(x => x.sku === sku);
        if (!p) continue;

        const cant = Number(d.cantidad);
        const costoUnitario = Number(d.cost);
        const stockActual = Math.max(0, p.stock_actual || 0);
        const stockTotal = stockActual + cant;
        const costoPromedio = ((stockActual * (p.costo || 0)) + (cant * costoUnitario)) / stockTotal;
        
        await supabase.from('compras_detalle').insert({ 
          compra_id: compraHeader.id, 
          producto_id: p.id, 
          sku: p.sku,
          nombre: p.nombre, 
          cantidad: cant, 
          costo_unitario: costoUnitario, 
          subtotal: cant * costoUnitario 
        });

        await supabase.from('productos').update({ 
          costo: Number(costoPromedio.toFixed(2)), 
          precio_venta: Number(d.prev), 
          stock_actual: stockTotal 
        }).eq('id', p.id);
      }

      alert("✅ Misión de Abasto Sincronizada."); 
      onBack();
    } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
  };

  const currentTotal = Object.values(registroCompra).reduce((a, b) => a + (Number(b.cantidad) * Number(b.cost) || 0), 0);

  if (loading) return <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]"><Zap className="text-green-500 animate-pulse" size={48} /></div>;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden animate-in fade-in">
      {/* HEADER */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#050505] shadow-2xl">
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-all active:scale-90"><X size={20} /></button>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Misión <span className="text-green-500">Central</span></h2>
          <div className="flex items-center gap-2 justify-center mt-1">
            <p className="text-[7px] text-gray-500 font-black uppercase tracking-widest">Presupuesto:</p>
            <p className="text-[9px] text-green-500 font-black">{formatCurrency(resumenMision.dinero)}</p>
          </div>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="p-4 bg-[#080808] border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16}/>
          <input type="text" placeholder="BUSCAR EN LA CENTRAL..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-green-500 uppercase outline-none focus:border-green-600" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48 no-scrollbar">
        {categoriesOrdered.map(cat => {
          const rawItems = analysis.filter(p => (p.categoria || 'Otros') === cat && (searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
          const items = [...rawItems].sort((a, b) => a.urg - b.urg);
          if (items.length === 0) return null;

          const minUrg = items.filter(i => i.activo !== false).length > 0 ? Math.min(...items.filter(i => i.activo !== false).map(i => i.urg)) : 3;
          const colorCat = minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : 'bg-green-500';

          return (
            <div key={cat} className={`rounded-[35px] border transition-all ${expandedCategory === cat ? 'bg-[#0A0A0A] border-white/10' : 'border-white/5 opacity-80'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${colorCat} ${minUrg <= 1 ? 'animate-pulse' : ''}`}></div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">{cat}</h3>
                </div>
                <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCategory === cat ? 'rotate-180' : ''}`}/>
              </button>

              {expandedCategory === cat && (
                <div className="px-4 pb-8 space-y-6">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, cost: item.costo, prev: item.precio_venta, mgn: OBJETIVOS_UTILIDAD[item.categoria] || 0.15 };
                    return (
                      <div key={item.sku} className={`p-6 rounded-[35px] border transition-all ${item.urg === 0 ? 'border-red-600/30 bg-red-600/[0.04]' : 'border-white/5 bg-white/[0.01]'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div><p className="text-[11px] font-black uppercase italic text-white">{item.nombre}</p><p className="text-[8px] text-gray-600 font-bold uppercase mt-1">Costo Actual: {formatCurrency(item.costo)}</p></div>
                          <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${item.urg === 0 ? 'bg-red-600 text-white' : 'bg-green-600/20 text-green-500'}`}>{item.stock_actual} {item.unidad}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2 tracking-widest">Cantidad</label>
                             <input type="number" value={data.cantidad || ''} onChange={(e) => updateRegistro(item.sku, 'cantidad', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" placeholder={`Sug: ${item.sug}`}/>
                          </div>
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2 tracking-widest">Costo Central</label>
                             <input type="number" value={data.cost} onChange={(e) => updateRegistro(item.sku, 'cost', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-white outline-none" />
                          </div>
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

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 z-[60]">
        <div className="max-w-7xl mx-auto flex justify-between items-end mb-4 px-2">
          <div><p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Inversión Actual</p><p className="text-3xl font-black text-white tracking-tighter">{formatCurrency(currentTotal)}</p></div>
          <p className="text-xl font-black text-green-500">{Object.values(registroCompra).filter(v => Number(v.cantidad) > 0).length} Artículos</p>
        </div>
        <button onClick={ejecutarCompraMaestra} disabled={issubmitting} className="w-full bg-green-600 h-16 rounded-[28px] text-black font-black uppercase text-xs tracking-[0.3em] active:scale-95 transition-all">
          {issubmitting ? 'Sincronizando...' : 'Finalizar y Cargar Stock'}
        </button>
      </div>
    </div>
  );
}
