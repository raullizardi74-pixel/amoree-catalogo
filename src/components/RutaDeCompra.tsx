import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  Zap, Target, Minus, Plus, ChevronDown, ChevronUp, 
  Clock, AlertTriangle, Save, PackageSearch, EyeOff, Eye, Search, X, TrendingUp
} from 'lucide-react';

const OBJETIVOS_UTILIDAD: Record<string, number> = {
  'Frutas': 0.40, 'Verduras': 0.30, 'Hojas y tallos': 0.42, 
  'Abarrotes': 0.30, 'Cremería': 0.22, 'Otros': 0.15
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
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prodData } = await supabase.from('productos').select('*');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: orderData } = await supabase.from('pedidos').select('detalle_pedido').eq('estado', 'Finalizado').gte('created_at', sevenDaysAgo.toISOString());
      if (prodData) setProducts(prodData);
      if (orderData) setSalesData(orderData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const analysis = useMemo(() => {
    let rawData = products.map(p => {
      let totalVendido = 0;
      salesData.forEach(order => {
        const item = order.detalle_pedido?.find((i: any) => (i.sku || i.SKU) === p.sku);
        if (item) totalVendido += item.quantity;
      });
      const promedioDiario = totalVendido / 7;
      const diasRestantes = promedioDiario > 0 ? p.stock_actual / promedioDiario : 99;
      const sugerido = Math.max(0, (promedioDiario * coverageDays) - p.stock_actual);

      let urgencia = 3;
      if (p.stock_actual === 0) urgencia = 0;
      else if (p.stock_actual <= 5) urgencia = 1;
      else if (diasRestantes < 1.5) urgencia = 2;

      return { 
        ...p, promedioDiario, diasRestantes, sugerido: Number(sugerido.toFixed(1)), 
        urgencia, margenObjetivo: OBJETIVOS_UTILIDAD[p.categoria] || 0.15 
      };
    });

    if (searchTerm) {
      rawData = rawData.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return rawData.sort((a, b) => a.urgencia - b.urgencia || a.stock_actual - b.stock_actual);
  }, [products, salesData, coverageDays, searchTerm]);

  const categoriesOrdered = useMemo(() => {
    const cats = Array.from(new Set(analysis.map(p => p.categoria || 'Otros')));
    return cats.sort((a, b) => {
      const minUrgA = Math.min(...analysis.filter(p => p.categoria === a).map(p => p.urgencia));
      const minUrgB = Math.min(...analysis.filter(p => p.categoria === b).map(p => p.urgencia));
      return minUrgA - minUrgB;
    });
  }, [analysis]);

  const toggleActivo = async (sku: string, estadoActual: any) => {
    const nuevoEstado = !(estadoActual === false ? false : true);
    try {
      await supabase.from('productos').update({ activo: nuevoEstado }).eq('sku', sku);
      setProducts(prev => prev.map(p => p.sku === sku ? { ...p, activo: nuevoEstado } : p));
    } catch (e) {
      setProducts(prev => prev.map(p => p.sku === sku ? { ...p, activo: nuevoEstado } : p));
    }
  };

  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const current = prev[sku] || { 
        cantidad: 0, costo_central: itemRef?.costo || 0, 
        precio_venta: itemRef?.precio_venta || 0, margen_actual: itemRef?.margenObjetivo || 0.15
      };
      let updated = { ...current, [field]: value };
      if (field === 'costo_central' || field === 'margen_actual') {
        updated.precio_venta = redondearPrecio(updated.costo_central * (1 + updated.margen_actual));
      }
      return { ...prev, [sku]: updated };
    });
  };

  const ejecutarCompraMaestra = async () => {
    const itemsAComprar = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    const pendientes = analysis.filter(p => p.activo !== false && p.urgencia <= 1 && (!registroCompra[p.sku] || registroCompra[p.sku].cantidad === 0));

    if (pendientes.length > 0) {
      const nombres = pendientes.slice(0, 5).map(p => `- ${p.nombre}`).join('\n');
      const msg = `⚠️ ATENCIÓN HUGO:\nFaltan ${pendientes.length} AGOTADOS/CRÍTICOS:\n${nombres}${pendientes.length > 5 ? '\n...y otros' : ''}\n\n¿Finalizar de todos modos?`;
      if (!window.confirm(msg)) return;
    }

    if (itemsAComprar.length === 0) return;
    setIsSubmitting(true);
    try {
      for (const [sku, data] of itemsAComprar) {
        const prod = products.find(p => p.sku === sku);
        await supabase.from('compras').insert({
          producto_sku: sku, nombre_producto: prod.nombre, cantidad: data.cantidad,
          unidad: prod.unidad, costo_unitario: data.costo_central,
          total_compra: data.cantidad * data.costo_central, proveedor: 'Central de Abastos'
        });
        await supabase.from('productos').update({
          costo: data.costo_central, precio_venta: data.precio_venta,
          stock_actual: prod.stock_actual + data.cantidad
        }).eq('sku', sku);
      }
      alert("✅ ¡Sincronizado!");
      onBack();
    } catch (e) { alert("Error."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">Atrás</button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase italic tracking-tighter">Hugo <span className="text-green-500">Master</span></h2>
          <p className="text-[7px] text-gray-500 font-bold tracking-widest uppercase">Central de Abastos OS</p>
        </div>
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-black font-black text-[10px] shadow-lg shadow-green-900/20">🛒</div>
      </div>

      {/* SEARCH & COBERTURA */}
      <div className="p-3 bg-[#050505] border-b border-white/10 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input 
            type="text" placeholder="BUSCAR ARTÍCULO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-[10px] font-bold text-green-500 uppercase outline-none focus:border-green-500/30"
          />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"><X size={14} /></button>}
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
             <Clock size={12} className="text-gray-500" />
             <p className="text-[8px] font-black uppercase text-gray-400">Cobertura:</p>
          </div>
          <div className="flex bg-black p-1 rounded-xl border border-white/5">
            {[2, 3, 5, 7].map(d => (
              <button key={d} onClick={() => setCoverageDays(d)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${coverageDays === d ? 'bg-white text-black' : 'text-gray-500'}`}>{d}D</button>
            ))}
          </div>
        </div>
      </div>

      {/* LISTADO */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        {categoriesOrdered.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const minUrg = Math.min(...items.map(i => i.urgencia));
          const colorCat = minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : 'bg-green-500';
          const isExpanded = expandedCategory === cat || searchTerm.length > 0;

          return (
            <div key={cat} className={`rounded-[30px] border transition-all ${isExpanded ? 'bg-[#080808] border-white/10' : 'border-white/5 opacity-80'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className={`w-2 h-2 rounded-full ${colorCat} ${minUrg === 0 && 'animate-ping'}`}></div>
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest">{cat}</h3>
                    <p className="text-[7px] text-gray-500 font-bold uppercase mt-0.5 italic">Urgencia: {Math.min(...items.map(i => i.diasRestantes)).toFixed(1)} días</p>
                  </div>
                </div>
                <ChevronDown size={14} className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
              </button>

              {isExpanded && (
                <div className="px-3 pb-6 space-y-4">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, costo_central: item.costo, precio_venta: item.precio_venta, margen_actual: item.margenObjetivo };
                    const esAgotado = item.stock_actual === 0;
                    const esBajo = item.stock_actual > 0 && item.stock_actual <= 5;
                    const cardColor = esAgotado ? 'border-red-600/40 bg-red-600/[0.04]' : esBajo ? 'border-orange-500/40 bg-orange-500/[0.04]' : 'border-white/5 bg-white/[0.02]';

                    return (
                      <div key={item.sku} className={`p-5 rounded-[28px] border relative transition-all ${cardColor} ${item.activo === false && 'opacity-30 grayscale'}`}>
                        
                        {/* HEADER DEL ARTÍCULO */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-3/4">
                            <div className="flex items-center gap-2 mb-1">
                               <p className="text-[11px] font-black uppercase text-white leading-tight">{item.nombre}</p>
                               {/* REUBICACIÓN DEL OJO: DISCRETO JUNTO AL NOMBRE */}
                               <button onClick={() => toggleActivo(item.sku, item.activo)} className="p-1 bg-white/5 rounded-md active:scale-75 transition-transform">
                                  {item.activo !== false ? <Eye size={10} className="text-green-500"/> : <EyeOff size={10} className="text-red-500"/>}
                               </button>
                            </div>
                            <p className="text-[7px] text-gray-500 font-bold uppercase">REF AMOREE: {formatCurrency(item.costo)}</p>
                          </div>
                          
                          {/* BADGES: STOCK FISICO + DIAS STOCK (RECUPERADO) */}
                          <div className="flex flex-col items-end gap-1">
                            <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${esAgotado ? 'bg-red-600 text-white animate-pulse' : esBajo ? 'bg-orange-500 text-black' : 'bg-green-500/20 text-green-500 border border-green-500/30'}`}>
                              {esAgotado ? 'AGOTADO' : `${item.stock_actual} ${item.unidad}`}
                            </div>
                            <div className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[6px] font-black text-gray-400 uppercase tracking-widest">
                               {item.diasRestantes.toFixed(1)} Días Stock
                            </div>
                          </div>
                        </div>

                        {/* INPUTS PRINCIPALES */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="relative">
                            <label className="text-[7px] font-black text-gray-500 uppercase ml-2 mb-1 block">Cantidad</label>
                            <input 
                              type="number" inputMode="decimal" value={data.cantidad || ''} 
                              onChange={(e) => updateRegistro(item.sku, 'cantidad', parseFloat(e.target.value), item)}
                              placeholder={`Sug: ${item.sugerido}`}
                              className="w-full bg-black border border-white/10 rounded-2xl py-4 px-4 text-xl font-black text-green-500 outline-none focus:border-green-500"
                            />
                            <button onClick={() => updateRegistro(item.sku, 'cantidad', item.sugerido, item)} className="absolute right-2 bottom-3 p-1.5 text-green-500 active:scale-75"><Zap size={14} fill="currentColor"/></button>
                          </div>
                          <div>
                            <label className="text-[7px] font-black text-gray-500 uppercase ml-2 mb-1 block">Costo Central</label>
                            <div className="relative bg-black border border-white/10 rounded-2xl p-4 flex items-center">
                                <span className="text-xs text-gray-600 font-black mr-1">$</span>
                                <input 
                                  type="number" inputMode="decimal" value={data.costo_central} 
                                  onChange={(e) => updateRegistro(item.sku, 'costo_central', parseFloat(e.target.value), item)}
                                  className="w-full bg-transparent font-black text-white text-xl outline-none"
                                />
                            </div>
                          </div>
                        </div>

                        {/* MARGEN Y UTILIDAD (RECUPERADO) */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="bg-black/50 border border-white/5 rounded-2xl p-3 flex items-center justify-between px-6">
                              <button onClick={() => updateRegistro(item.sku, 'margen_actual', data.margen_actual - 0.01, item)} className="text-gray-500"><Minus size={14}/></button>
                              <div className="text-center">
                                 <p className="text-[6px] text-gray-600 font-black uppercase">Margen</p>
                                 <p className={`text-xs font-black ${data.margen_actual < item.margenObjetivo ? 'text-red-500' : 'text-green-500'}`}>{(data.margen_actual * 100).toFixed(0)}%</p>
                              </div>
                              <button onClick={() => updateRegistro(item.sku, 'margen_actual', data.margen_actual + 0.01, item)} className="text-gray-500"><Plus size={14}/></button>
                           </div>
                           <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-3 flex flex-col items-center justify-center">
                              <p className="text-[6px] text-green-600 font-black uppercase">Utilidad Proyectada</p>
                              <p className="text-xs font-black text-white">+{formatCurrency(data.precio_venta - data.costo_central)}</p>
                           </div>
                        </div>

                        {/* PRECIO VENTA FINAL */}
                        <div className="bg-gradient-to-r from-green-500/10 to-transparent p-4 rounded-2xl border border-green-500/20 flex justify-between items-center">
                           <div>
                              <label className="text-[7px] font-black text-green-500 uppercase flex items-center gap-1 mb-1"><Target size={10}/> Precio Venta Sugerido (.50)</label>
                              <p className="text-2xl font-black text-white">{formatCurrency(data.precio_venta)}</p>
                           </div>
                           <TrendingUp size={24} className="text-green-500/20" />
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

      {/* FOOTER TOTALIZADOR */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center mb-4 px-2">
            <div>
               <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Inversión Estimada</p>
               <p className="text-2xl font-black text-white">{formatCurrency(Object.values(registroCompra).reduce((acc, curr) => acc + (curr.cantidad * (curr.costo_central || 0)), 0))}</p>
            </div>
            <div className="text-right">
               <p className="text-[8px] font-black text-gray-500 uppercase">Surtido</p>
               <p className="text-lg font-black text-green-500">{Object.values(registroCompra).filter(v => v.cantidad > 0).length} ITEMS</p>
            </div>
        </div>
        <button 
          onClick={ejecutarCompraMaestra} disabled={issubmitting}
          className="w-full bg-green-600 h-16 rounded-[24px] text-black font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-green-900/20"
        >
          {issubmitting ? 'Sincronizando Tienda...' : 'Finalizar Operación'}
        </button>
      </div>
    </div>
  );
}
