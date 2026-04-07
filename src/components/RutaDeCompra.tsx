import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Zap, ChevronDown, Search, ClipboardList, CheckCircle2, X, ShoppingCart, Loader2 
} from 'lucide-react';
import { format } from 'date-fns';

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchData = async () => {
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
      let urg = (stock <= 0) ? 0 : (stock <= 2 ? 1 : 3);
      return { ...p, sug: Number(sug.toFixed(1)), urg };
    });
  }, [products, salesData]);

  const sortedCategories = useMemo(() => {
    const catMap: Record<string, number> = {};
    analysis.forEach(p => {
      const cat = p.categoria || 'Otros';
      if (catMap[cat] === undefined || p.urg < catMap[cat]) {
        catMap[cat] = p.urg;
      }
    });
    return Object.keys(catMap).sort((a, b) => catMap[a] - catMap[b]);
  }, [analysis]);

  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const cur = prev[sku] || { 
        cantidad: 0, 
        cost: itemRef?.costo || 0, 
        prev: itemRef?.precio_venta || 0,
        nombre: itemRef?.nombre
      };
      return { ...prev, [sku]: { ...cur, [field]: value } };
    });
  };

  // ✅ EJECUCIÓN MAESTRA: Ahora sí guarda en 'compras_detalle'
  const ejecutarCompraMaestra = async () => {
    const itemsParaComprar = Object.entries(registroCompra).filter(([_, val]) => Number(val.cantidad) > 0);
    if (itemsParaComprar.length === 0) return alert("Socio, el carrito está vacío.");
    
    setIsSubmitting(true);
    try {
      const totalNota = itemsParaComprar.reduce((a, [_, d]) => a + (Number(d.cantidad) * Number(d.cost) || 0), 0);
      const folioGen = `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`;

      // 1. Crear la Cabecera (Para el Corte de Caja)
      const { data: compraHeader, error: errH } = await supabase.from('compras').insert({ 
        proveedor: 'ABASTO CENTRAL',
        folio: folioGen, 
        total: totalNota,
        metodo_pago: 'Efectivo'
      }).select().single();

      if (errH) throw errH;

      // 2. Crear los Renglones (Para el Historial/Radar) y actualizar Stock
      for (const [sku, d] of itemsParaComprar) {
        const p = products.find(x => x.sku === sku);
        if (!p) continue;

        const cantNum = Number(d.cantidad);
        const costoNum = Number(d.cost);

        // Registro de detalle individual
        await supabase.from('compras_detalle').insert({
          compra_id: compraHeader.id,
          producto_id: p.id,
          sku: sku,
          nombre: p.nombre,
          cantidad: cantNum,
          costo_unitario: costoNum,
          subtotal: Number((cantNum * costoNum).toFixed(2))
        });

        // Actualización de producto con limpieza de decimales
        await supabase.from('productos').update({ 
          costo: costoNum, 
          stock_actual: Number(((p.stock_actual || 0) + cantNum).toFixed(3)) 
        }).eq('id', p.id);
      }

      alert("✅ Sincronización Titanium Exitosa."); 
      onBack();
    } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
  };

  const currentTotal = Object.values(registroCompra).reduce((a, b) => a + (Number(b.cantidad) * Number(b.cost) || 0), 0);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="text-green-500 animate-spin" size={48}/></div>;

  return (
    <div className="bg-[#050505] min-h-screen pb-48 font-sans text-white">
      {/* HEADER */}
      <div className="p-6 bg-black border-b border-white/10 flex justify-between items-center sticky top-0 z-[70] backdrop-blur-xl">
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl active:scale-90 border border-white/10"><X size={20}/></button>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Misión <span className="text-green-500">Central</span></h2>
          <p className="text-[9px] text-green-500 font-black">{formatCurrency(currentTotal)}</p>
        </div>
        <button onClick={() => setShowChecklist(true)} className="relative bg-white/5 p-3 rounded-2xl border border-white/10">
          <ClipboardList size={22} className={Object.keys(registroCompra).length > 0 ? 'text-green-500' : 'text-gray-500'} />
        </button>
      </div>

      <div className="p-4 bg-black/50 border-b border-white/5">
        <div className="relative max-w-7xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
          <input type="text" placeholder="BUSCAR EN RUTA..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-green-500 uppercase outline-none focus:border-green-500" />
        </div>
      </div>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {sortedCategories.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat && p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
          if (items.length === 0) return null;
          const minUrg = Math.min(...items.map(i => i.urg));

          return (
            <div key={cat} className={`border rounded-[35px] overflow-hidden transition-all ${expandedCategory === cat ? 'bg-[#0A0A0A] border-white/10' : 'border-white/5 bg-white/[0.01]'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] ${minUrg === 0 ? 'bg-red-500 shadow-red-500/50' : minUrg === 1 ? 'bg-orange-500 shadow-orange-500/50' : 'bg-green-500 shadow-green-500/50'}`}></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">{cat}</span>
                </div>
                <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCategory === cat ? 'rotate-180' : ''}`}/>
              </button>

              {expandedCategory === cat && (
                <div className="p-4 space-y-6 bg-black/40">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: '', cost: item.costo };
                    return (
                      <div key={item.sku} className={`p-6 rounded-[2.5rem] border ${item.urg === 0 ? 'border-red-600/30 bg-red-600/[0.03]' : 'border-white/5 bg-white/[0.01]'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <p className="text-xs font-black uppercase text-white">{item.nombre}</p>
                            <p className="text-[9px] text-gray-500 font-bold tracking-widest">STOCK: {Number(item.stock_actual.toFixed(3))} {item.unidad}</p>
                          </div>
                          {item.urg < 3 && <span className={`text-[9px] font-black px-3 py-1 rounded-full ${item.urg === 0 ? 'bg-red-500 text-white' : 'bg-orange-500 text-black'}`}>Sug: +{item.sug}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2">Comprar</label>
                             <input type="number" value={data.cantidad} onChange={(e) => updateRegistro(item.sku, 'cantidad', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" placeholder="0.0"/>
                          </div>
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2">Costo</label>
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

      {/* FOOTER ACCIÓN */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 z-[60] shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-end mb-4">
          <div><p className="text-[9px] font-black text-gray-600 uppercase mb-1">Inversión Total</p><p className="text-3xl font-black text-white">{formatCurrency(currentTotal)}</p></div>
        </div>
        <button onClick={ejecutarCompraMaestra} disabled={issubmitting} className="w-full bg-green-600 h-16 rounded-[2rem] text-black font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3">
          {issubmitting ? 'Sincronizando...' : <><ShoppingCart size={18}/> Finalizar y Cargar Stock</>}
        </button>
      </div>
    </div>
  );
}
