import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Zap, ChevronDown, Search, ClipboardList, CheckCircle2, X, ShoppingCart, Loader2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ ESTADOS DE MISIÓN
  const [showChecklist, setShowChecklist] = useState(false);
  const [ordenPlaneada, setOrdenPlaneada] = useState<any>(null);
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: p } = await supabase.from('productos').select('*');
        const { data: o } = await supabase.from('pedidos')
          .select('detalle_pedido')
          .eq('estado', 'Finalizado')
          .gte('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
        
        // Buscar Plan Pendiente (Central / Abasto / Todos)
        const { data: mision } = await supabase
          .from('ordenes_abasto')
          .select('*')
          .eq('estado', 'Pendiente')
          .or('proveedor_nombre.ilike.%CENTRAL%,proveedor_id.eq.1,proveedor_id.eq.TODOS')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (p) setProducts(p);
        if (o) setSalesData(o);
        
        if (mision) {
          setOrdenPlaneada(mision);
          const preCarga: Record<string, any> = {};
          mision.items.forEach((item: any) => {
            preCarga[item.sku] = {
              cantidad: item.cantidad_sugerida,
              cost: item.costo_base,
              nombre: item.nombre
            };
          });
          setRegistroCompra(preCarga);
        }
      } catch (e) { console.error("Error:", e); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // ✅ CEREBRO DE PRIORIDAD Y SEMÁFORO
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
      if (catMap[cat] === undefined || p.urg < catMap[cat]) catMap[cat] = p.urg;
    });
    return Object.keys(catMap).sort((a, b) => catMap[a] - catMap[b]);
  }, [analysis]);

  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const cur = prev[sku] || { cantidad: '', cost: itemRef?.costo || 0, nombre: itemRef?.nombre };
      return { ...prev, [sku]: { ...cur, [field]: value } };
    });
  };

  // ✅ FINALIZAR CON ADVERTENCIA DE PENDIENTES
  const ejecutarCompraMaestra = async () => {
    const itemsComprados = Object.entries(registroCompra).filter(([_, val]) => Number(val.cantidad) > 0);
    
    // Validar si faltan artículos del plan original
    if (ordenPlaneada) {
      const skusComprados = itemsComprados.map(([sku]) => sku);
      const faltantes = ordenPlaneada.items.filter((i: any) => !skusComprados.includes(i.sku));
      
      if (faltantes.length > 0) {
        const confirm = window.confirm(`⚠️ Hugo, faltan ${faltantes.length} productos de la lista planeada.\n\n¿Seguro que quieres cerrar la compra así?`);
        if (!confirm) return;
      }
    }

    if (itemsComprados.length === 0) return alert("Socio, no has ingresado ninguna cantidad.");

    setIsSubmitting(true);
    try {
      const totalNota = itemsComprados.reduce((a, [_, d]) => a + (Number(d.cantidad) * Number(d.cost) || 0), 0);
      const folioGen = `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`;

      const { data: compraHeader, error: errH } = await supabase.from('compras').insert({ 
        proveedor: 'ABASTO CENTRAL', folio: folioGen, total: totalNota, metodo_pago: 'Efectivo'
      }).select().single();

      if (errH) throw errH;

      for (const [sku, d] of itemsComprados) {
        const p = products.find(x => x.sku === sku);
        if (!p) continue;
        await supabase.from('compras_detalle').insert({
          compra_id: compraHeader.id, producto_id: p.id, sku: sku, nombre: p.nombre,
          cantidad: Number(d.cantidad), costo_unitario: Number(d.cost),
          subtotal: Number((Number(d.cantidad) * Number(d.cost)).toFixed(2))
        });
        await supabase.from('productos').update({ 
          costo: Number(d.cost), stock_actual: Number(((p.stock_actual || 0) + Number(d.cantidad)).toFixed(3)) 
        }).eq('id', p.id);
      }

      if (ordenPlaneada) {
        await supabase.from('ordenes_abasto').update({ estado: 'Completado', compra_id: compraHeader.id }).eq('id', ordenPlaneada.id);
      }

      alert("🚀 Misión Finalizada."); 
      onBack();
    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setIsSubmitting(false); }
  };

  const currentTotal = Object.values(registroCompra).reduce((a, b) => a + (Number(b.cantidad) * Number(b.cost) || 0), 0);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="text-green-500 animate-spin" size={48}/></div>;

  return (
    <div className="bg-[#050505] min-h-screen pb-48 font-sans text-white">
      
      {/* HEADER DINÁMICO */}
      <div className="p-6 bg-black border-b border-white/10 flex justify-between items-center sticky top-0 z-[70] backdrop-blur-xl">
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl border border-white/10"><X size={20}/></button>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Misión <span className="text-green-500">Central</span></h2>
          <p className="text-[9px] text-green-500 font-black tracking-widest">{formatCurrency(currentTotal)}</p>
        </div>
        {/* ✅ BOTÓN LISTA DE COMPRA (CHECKLIST) */}
        <button 
          onClick={() => setShowChecklist(true)} 
          className="relative bg-blue-600 p-3 rounded-2xl border border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-90 transition-all"
        >
          <ClipboardList size={22} className="text-white" />
          {ordenPlaneada && <span className="absolute -top-1 -right-1 bg-red-600 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black">{ordenPlaneada.items.length}</span>}
        </button>
      </div>

      {/* BANNER MISIÓN */}
      {ordenPlaneada && (
        <div className="mx-6 mt-6 p-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-3">
             <Zap className="text-blue-500" size={18} fill="currentColor"/>
             <div><p className="text-[10px] font-black uppercase text-white leading-none">Plan de Abasto Activo</p><p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-1 italic">Toca el botón azul para ver la lista</p></div>
           </div>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="p-6">
        <div className="relative max-w-7xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
          <input type="text" placeholder="BUSCAR O AÑADIR EXTRA..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black uppercase outline-none focus:border-green-500" />
        </div>
      </div>

      {/* LISTA ORDENADA POR PRIORIDAD */}
      <div className="px-6 space-y-4 max-w-7xl mx-auto">
        {sortedCategories.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat && p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
          if (items.length === 0) return null;

          const sortedItems = [...items].sort((a, b) => a.urg - b.urg);
          const minUrg = Math.min(...items.map(i => i.urg));

          return (
            <div key={cat} className={`border rounded-[35px] overflow-hidden transition-all ${expandedCategory === cat ? 'bg-[#0A0A0A] border-white/10' : 'border-white/5 bg-white/[0.01]'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {/* SEMÁFORO RESTAURADO */}
                  <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] ${minUrg === 0 ? 'bg-red-500 shadow-red-500' : minUrg === 1 ? 'bg-orange-500 shadow-orange-500' : 'bg-green-500 shadow-green-500'}`}></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">{cat}</span>
                </div>
                <ChevronDown size={16} className={expandedCategory === cat ? 'rotate-180' : ''}/>
              </button>

              {expandedCategory === cat && (
                <div className="p-4 space-y-4 bg-black/40">
                  {sortedItems.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: '', cost: item.costo };
                    const estaEnPlan = ordenPlaneada?.items.some((i: any) => i.sku === item.sku);

                    return (
                      <div key={item.sku} className={`p-6 rounded-[2.5rem] border ${estaEnPlan ? 'border-blue-500/30 bg-blue-500/5' : item.urg === 0 ? 'border-red-600/10' : 'border-white/5'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <p className="text-xs font-black uppercase text-white">{item.nombre}</p>
                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-1 tracking-widest">STOCK: {Number(item.stock_actual.toFixed(3))} {item.unidad}</p>
                            {estaEnPlan && <span className="text-[7px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase mt-2 inline-block">Misión</span>}
                          </div>
                          {item.urg < 3 && <span className={`text-[9px] font-black px-3 py-1 rounded-full ${item.urg === 0 ? 'bg-red-500 text-white' : 'bg-orange-500 text-black'}`}>Sug: +{item.sug}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black p-4 rounded-2xl border border-white/5 shadow-inner">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-1 italic">Cantidad</label>
                             <input type="number" value={data.cantidad} onChange={(e) => updateRegistro(item.sku, 'cantidad', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" placeholder="0.0"/>
                          </div>
                          <div className="bg-black p-4 rounded-2xl border border-white/5 shadow-inner">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-1 italic">Costo Pagado</label>
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

      {/* ✅ MODAL: LISTA DE COMPRA (RESUMEN) */}
      {showChecklist && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom duration-500">
           <div className="p-8 border-b border-white/10 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">Misión <span className="text-blue-500">Central</span></h3>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">Checklist de Abasto</p>
              </div>
              <button onClick={() => setShowChecklist(false)} className="bg-white/5 p-4 rounded-full"><X size={24}/></button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
              {ordenPlaneada ? ordenPlaneada.items.map((item: any, idx: number) => {
                const comprado = Number(registroCompra[item.sku]?.cantidad || 0) > 0;
                return (
                  <div key={idx} className={`p-6 rounded-[30px] border flex justify-between items-center transition-all ${comprado ? 'bg-green-500/10 border-green-500/40' : 'bg-white/[0.02] border-white/5 opacity-60'}`}>
                    <div>
                      <p className={`text-xs font-black uppercase ${comprado ? 'text-green-500' : 'text-white'}`}>{item.nombre}</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase mt-1">Planeado: {item.cantidad_sugerida} {item.unidad}</p>
                    </div>
                    {comprado ? <CheckCircle2 className="text-green-500" size={20}/> : <div className="w-5 h-5 border-2 border-white/10 rounded-full"/>}
                  </div>
                );
              }) : (
                <div className="text-center py-20">
                  <AlertCircle className="mx-auto text-gray-700 mb-4" size={48}/>
                  <p className="text-xs font-black text-gray-500 uppercase italic">No hay una misión planeada cargada.</p>
                </div>
              )}
           </div>

           <div className="p-8 bg-black border-t border-white/10">
              <button onClick={() => setShowChecklist(false)} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] active:scale-95 transition-all">Cerrar y Seguir Comprando</button>
           </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 z-[60] shadow-2xl backdrop-blur-xl">
        <button onClick={ejecutarCompraMaestra} disabled={issubmitting} className="w-full bg-green-600 h-16 rounded-[2rem] text-black font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3">
          {issubmitting ? 'Sincronizando...' : <><ShoppingCart size={18}/> Finalizar Misión</>}
        </button>
      </div>
    </div>
  );
}
