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

  // 🧠 CEREBRO DE ANÁLISIS: Calcula Sugerencias y Urgencia
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

  // Cálculo de Presupuesto Inicial (Lo que Hugo necesita antes de salir)
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
        id: itemRef?.id // ✅ CRUCIAL: Guardar ID para evitar NULL
      };
      let upd = { ...cur, [field]: value };
      if (field === 'cost') upd.prev = redondearPrecio(parseFloat(value || 0) * (1 + upd.mgn));
      return { ...prev, [sku]: upd };
    });
  };

  // ✅ GUARDADO BLINDADO: Mapea ID y SKU para evitar NULLs en Supabase
  const ejecutarCompraMaestra = async () => {
    const items = Object.entries(registroCompra).filter(([_, val]) => Number(val.cantidad) > 0);
    if (items.length === 0) return alert("Socio, no hay productos en el carrito.");
    
    setIsSubmitting(true);
    try {
      const tot = items.reduce((a, [_, d]) => a + (Number(d.cantidad) * Number(d.cost) || 0), 0);
      
      const { data: h, error: errH } = await supabase.from('compras').insert({ 
        proveedor_id: 1, 
        folio: `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`, 
        total: tot 
      }).select().single();

      if (errH) throw errH;

      for (const [sku, d] of items) {
        const p = products.find(x => x.sku === sku);
        if (!p) continue;

        const cant = Number(d.cantidad);
        const costo = Number(d.cost);
        const stockActual = Math.max(0, p.stock_actual || 0);
        const stockTotal = stockActual + cant;
        const costoPromedio = ((stockActual * (p.costo || 0)) + (cant * costo)) / stockTotal;
        
        // ✅ INSERCIÓN EXPLÍCITA DE PRODUCTO_ID Y SKU (ADIÓS AL NULL)
        await supabase.from('compras_detalle').insert({ 
          compra_id: h.id, 
          producto_id: p.id, 
          sku: p.sku,
          nombre: p.nombre, 
          cantidad: cant, 
          costo_unitario: costo, 
          subtotal: cant * costo 
        });

        await supabase.from('productos').update({ 
          costo: Number(costoPromedio.toFixed(2)), 
          precio_venta: Number(d.prev), 
          stock_actual: stockTotal 
        }).eq('id', p.id);
      }

      alert("✅ ¡Misión Cumplida! Inventario y Supabase actualizados."); 
      onBack();
    } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
  };

  const currentTotal = Object.values(registroCompra).reduce((a, b) => a + (Number(b.cantidad) * Number(b.cost) || 0), 0);

  if (loading) return <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]"><Zap className="text-green-500 animate-pulse" size={48} /></div>;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden animate-in fade-in">
      
      {/* HEADER DE MISIÓN */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#050505] shadow-2xl">
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-all active:scale-90"><X size={20} /></button>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Misión <span className="text-green-500">Central</span></h2>
          <div className="flex items-center gap-2 justify-center mt-1">
            <p className="text-[7px] text-gray-500 font-black uppercase tracking-widest">Presupuesto Estimado:</p>
            <p className="text-[9px] text-green-500 font-black">{formatCurrency(resumenMision.dinero)}</p>
          </div>
        </div>
        <button onClick={() => setShowChecklist(true)} className="relative bg-white/5 p-3 rounded-2xl border border-white/10">
          <ClipboardList size={20} className={currentTotal > 0 ? 'text-green-500' : 'text-gray-500'} />
          {analysis.filter(p => p.urg < 3 && p.activo !== false).length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {analysis.filter(p => p.urg < 3 && p.activo !== false).length}
            </span>
          )}
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="p-4 bg-[#080808] border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16}/>
          <input type="text" placeholder="BUSCAR ARTÍCULO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-green-500 uppercase outline-none focus:border-green-600" />
        </div>
      </div>

      {/* CUERPO DE RUTA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48 no-scrollbar">
        {categoriesOrdered.map(cat => {
          const rawItems = analysis.filter(p => (p.categoria || 'Otros') === cat && (searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
          const items = [...rawItems].sort((a, b) => a.urg - b.urg);
          const itemsActivos = items.filter(i => i.activo !== false);
          if (items.length === 0) return null;

          const minUrg = itemsActivos.length > 0 ? Math.min(...itemsActivos.map(i => i.urg)) : 3;
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
                    const cardColor = item.urg === 0 ? 'border-red-600/30 bg-red-600/[0.04]' : item.urg === 1 ? 'border-orange-500/30 bg-orange-500/[0.04]' : 'border-white/5 bg-white/[0.01]';
                    const yaComprado = Number(data.cantidad) > 0;

                    return (
                      <div key={item.sku} className={`p-6 rounded-[35px] border transition-all ${cardColor} ${item.activo === false ? 'opacity-10 grayscale' : ''}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] font-black uppercase italic text-white leading-tight">{item.nombre}</p>
                              {yaComprado && <CheckCircle2 size={14} className="text-green-500" />}
                            </div>
                            <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase">Costo Actual: {formatCurrency(item.costo)}</p>
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${item.urg === 0 ? 'bg-red-600 text-white' : item.urg === 1 ? 'bg-orange-500 text-black' : 'bg-green-600/20 text-green-500'}`}>
                            {item.stock_actual} {item.unidad}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className={`bg-black/50 p-4 rounded-2xl border transition-all ${yaComprado ? 'border-green-500/30' : 'border-white/5'}`}>
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2 tracking-widest">¿Cuánto Compras? ({item.unidad})</label>
                             <input type="number" value={data.cantidad || ''} onChange={(e) => updateRegistro(item.sku, 'cantidad', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" placeholder={`Sug: ${item.sug}`}/>
                          </div>
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2 tracking-widest">Costo Central</label>
                             <input type="number" value={data.cost} onChange={(e) => updateRegistro(item.sku, 'cost', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-white outline-none" />
                          </div>
                        </div>

                        {yaComprado && (
                          <div className="mt-4 p-5 bg-white/[0.03] border border-white/5 rounded-3xl flex justify-between items-center animate-in slide-in-from-top">
                             <div>
                               <p className="text-[7px] text-gray-500 font-black uppercase mb-1 italic">Sugerencia Amoree p/ Venta</p>
                               <div className="flex items-center gap-3"><p className="text-xl font-black text-white">{formatCurrency(data.prev)}</p><ArrowRight size={14} className="text-gray-700" /><p className="text-[9px] text-gray-500 uppercase font-black">{Math.round(data.mgn * 100)}% Margen</p></div>
                             </div>
                             <TrendingUp className={data.cost > item.costo ? 'text-red-500' : 'text-green-500'} size={24} />
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

      {/* ✅ MODAL DE CHECKLIST (LISTA DE MISIÓN) */}
      {showChecklist && (
        <div className="fixed inset-0 z-[100] bg-black animate-in slide-in-from-bottom duration-500 flex flex-col">
          <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#050505] shadow-2xl">
             <div><h3 className="text-3xl font-black uppercase italic tracking-tighter">Lista de <span className="text-green-500">Misión</span></h3><p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">Hugo, esto es lo que falta/llevas</p></div>
             <button onClick={() => setShowChecklist(false)} className="bg-white/5 p-4 rounded-full text-white hover:bg-white/10 transition-all active:rotate-90"><X size={24}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-40">
            {/* SECCIÓN PENDIENTES */}
            <div>
              <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.3em] mb-4">🛒 POR COMPRAR</p>
              <div className="space-y-3">
                {analysis.filter(p => p.urg < 3 && p.activo !== false && !registroCompra[p.sku]?.cantidad).map(p => (
                  <div key={p.sku} className="bg-white/[0.02] border border-white/5 p-6 rounded-[30px] flex justify-between items-center opacity-70">
                    <div><p className="text-xs font-black uppercase text-white">{p.nombre}</p><p className="text-[8px] text-gray-500 font-bold uppercase">Sugerido: {p.sug} {p.unidad}</p></div>
                    <p className="text-xs font-black text-gray-600 italic">Pendiente</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN LISTOS (LO QUE YA SE ANOTÓ) */}
            <div>
              <p className="text-[9px] font-black text-green-500 uppercase tracking-[0.3em] mb-4">✅ YA EN CAMIONETA</p>
              <div className="space-y-3">
                {Object.entries(registroCompra).filter(([_, v]) => Number(v.cantidad) > 0).map(([sku, v]) => (
                  <div key={sku} className="bg-green-500/5 border border-green-500/20 p-6 rounded-[30px] flex justify-between items-center shadow-xl">
                    <div className="flex items-center gap-4">
                      <CheckCircle2 size={20} className="text-green-500"/>
                      <div><p className="text-xs font-black uppercase text-white italic">{v.nombre}</p><p className="text-[8px] text-green-500/60 font-black uppercase tracking-widest">Cant: {v.cantidad} | Total: {formatCurrency(v.cantidad * v.cost)}</p></div>
                    </div>
                    <div className="text-right"><p className="text-xs font-black text-white">{formatCurrency(Number(v.cost))}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-8 bg-black border-t border-white/10"><button onClick={() => setShowChecklist(false)} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-2xl active:scale-95 transition-all">Regresar a Surtir</button></div>
        </div>
      )}

      {/* FOOTER DE IMPACTO */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,1)] z-[60]">
        <div className="max-w-7xl mx-auto flex justify-between items-end mb-4 px-2">
          <div><p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Inversión Actual</p><p className="text-3xl font-black text-white tracking-tighter">{formatCurrency(currentTotal)}</p></div>
          <div className="text-right"><p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Artículos</p><p className="text-xl font-black text-green-500">{Object.values(registroCompra).filter(v => Number(v.cantidad) > 0).length}</p></div>
        </div>
        <button onClick={ejecutarCompraMaestra} disabled={issubmitting} className="w-full bg-green-600 h-16 rounded-[28px] text-black font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-green-900/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
          {issubmitting ? 'Sincronizando Misión...' : <><Save size={18}/> Finalizar y Cargar Stock</>}
        </button>
      </div>
    </div>
  );
}
