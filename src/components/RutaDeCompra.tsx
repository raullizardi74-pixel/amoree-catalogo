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
    if (items.length === 0) return alert("Socio, el carrito está vacío.");
    
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

      alert("✅ Sincronización Exitosa."); 
      onBack();
    } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
  };

  const currentTotal = Object.values(registroCompra).reduce((a, b) => a + (Number(b.cantidad) * Number(b.cost) || 0), 0);
  const itemsCompradosCount = Object.values(registroCompra).filter(v => Number(v.cantidad) > 0).length;

  if (loading) return <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]"><Zap className="text-green-500 animate-pulse" size={48} /></div>;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden animate-in fade-in">
      {/* HEADER */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#050505] shadow-2xl">
        <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl active:scale-90"><X size={20} /></button>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Misión <span className="text-green-500">Central</span></h2>
          <p className="text-[9px] text-green-500 font-black">{formatCurrency(currentTotal)}</p>
        </div>
        <button onClick={() => setShowChecklist(true)} className="relative bg-white/5 p-3 rounded-2xl border border-white/10">
          <ClipboardList size={20} className={itemsCompradosCount > 0 ? 'text-green-500' : 'text-gray-500'} />
          {analysis.filter(p => p.urg < 3 && p.activo !== false).length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {analysis.filter(p => p.urg < 3 && p.activo !== false).length}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 bg-[#080808] border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16}/>
          <input type="text" placeholder="BUSCAR ARTÍCULO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-black text-green-500 uppercase outline-none focus:border-green-600" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48 no-scrollbar">
        {Array.from(new Set(analysis.map(p => p.categoria || 'Otros'))).map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat && (searchTerm === '' || p.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
          if (items.length === 0) return null;
          const minUrg = items.filter(i => i.activo !== false).length > 0 ? Math.min(...items.filter(i => i.activo !== false).map(i => i.urg)) : 3;

          return (
            <div key={cat} className={`rounded-[35px] border transition-all ${expandedCategory === cat ? 'bg-[#0A0A0A] border-white/10' : 'border-white/5'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">{cat}</h3>
                </div>
                <ChevronDown size={16} className={`text-gray-600 ${expandedCategory === cat ? 'rotate-180' : ''}`}/>
              </button>
              {expandedCategory === cat && (
                <div className="px-4 pb-8 space-y-6">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, cost: item.costo };
                    return (
                      <div key={item.sku} className={`p-6 rounded-[35px] border ${item.urg === 0 ? 'border-red-600/30 bg-red-600/[0.04]' : 'border-white/5 bg-white/[0.01]'}`}>
                        <div className="flex justify-between items-start mb-6">
                          <div><p className="text-[11px] font-black uppercase text-white">{item.nombre}</p><p className="text-[8px] text-gray-600 uppercase">Stock: {item.stock_actual} {item.unidad}</p></div>
                          {Number(data.cantidad) > 0 && <CheckCircle2 size={16} className="text-green-500"/>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                             <label className="text-[7px] text-gray-500 uppercase font-black block mb-2">Cantidad</label>
                             <input type="number" value={data.cantidad || ''} onChange={(e) => updateRegistro(item.sku, 'cantidad', e.target.value, item)} className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" placeholder={`Sug: ${item.sug}`}/>
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

      {/* ✅ MODAL DE CHECKLIST: EL RECUERDO DE HUGO */}
      {showChecklist && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in slide-in-from-bottom">
          <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#050505]">
            <div><h3 className="text-3xl font-black uppercase italic tracking-tighter">Lista de <span className="text-green-500">Misión</span></h3></div>
            <button onClick={() => setShowChecklist(false)} className="bg-white/5 p-4 rounded-full"><X size={24}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div>
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-4">🛒 POR COMPRAR</p>
              <div className="space-y-3">
                {analysis.filter(p => p.urg < 3 && p.activo !== false && !registroCompra[p.sku]?.cantidad).map(p => (
                  <div key={p.sku} className="bg-white/[0.02] border border-white/5 p-5 rounded-[25px] flex justify-between items-center">
                    <p className="text-xs font-black uppercase">{p.nombre}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{p.sug} {p.unidad}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-4">✅ YA EN CAMIONETA</p>
              <div className="space-y-3">
                {Object.entries(registroCompra).filter(([_, v]) => Number(v.cantidad) > 0).map(([sku, v]) => (
                  <div key={sku} className="bg-green-500/5 border border-green-500/20 p-5 rounded-[25px] flex justify-between items-center">
                    <p className="text-xs font-black uppercase text-white">{v.nombre}</p>
                    <p className="text-xs font-black text-green-500">{v.cantidad}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-8"><button onClick={() => setShowChecklist(false)} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest">Regresar a Surtir</button></div>
        </div>
      )}

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 z-[60] shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-end mb-4">
          <div><p className="text-[9px] font-black text-gray-600 uppercase mb-1">Inversión Actual</p><p className="text-3xl font-black text-white">{formatCurrency(currentTotal)}</p></div>
          <p className="text-xl font-black text-green-500">{itemsCompradosCount} Artículos</p>
        </div>
        <button onClick={ejecutarCompraMaestra} disabled={issubmitting} className="w-full bg-green-600 h-16 rounded-[28px] text-black font-black uppercase text-xs tracking-widest active:scale-95 transition-all">
          {issubmitting ? 'Sincronizando...' : 'Finalizar y Cargar Stock'}
        </button>
      </div>
    </div>
  );
}
