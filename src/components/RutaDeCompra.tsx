import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  Zap, Target, Minus, Plus, ChevronDown, ChevronUp, 
  Clock, AlertTriangle, Save, PackageSearch, EyeOff, Eye, Search, X
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
  const [searchTerm, setSearchTerm] = useState(''); // <--- NUEVO: Estado de búsqueda
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

  // --- MOTOR TITANIUM V2.1: FILTRADO Y PRIORIDAD ---
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

      // Jerarquía: 0=Agotado(Rojo), 1=Crítico(Naranja), 2=Bajo(Amarillo), 3=Sano(Verde)
      let urgencia = 3;
      if (p.stock_actual === 0) urgencia = 0;
      else if (p.stock_actual <= 5) urgencia = 1;
      else if (diasRestantes < 1.5) urgencia = 2;

      return { 
        ...p, promedioDiario, diasRestantes, sugerido: Number(sugerido.toFixed(1)), 
        urgencia, margenObjetivo: OBJETIVOS_UTILIDAD[p.categoria] || 0.15 
      };
    });

    // APLICAR BÚSQUEDA
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
    const nuevoEstado = !(estadoActual === false ? false : true); // Manejo por si es null/undefined
    try {
      // Intentamos actualizar, si falla es que no existe la columna (pero no crashea la app)
      await supabase.from('productos').update({ activo: !estadoActual }).eq('sku', sku);
      setProducts(prev => prev.map(p => p.sku === sku ? { ...p, activo: !estadoActual } : p));
    } catch (e) {
      // Fallback local si no hay columna
      setProducts(prev => prev.map(p => p.sku === sku ? { ...p, activo: !estadoActual } : p));
    }
  };

  const ejecutarCompraMaestra = async () => {
    const itemsAComprar = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    const pendientes = analysis.filter(p => p.activo !== false && p.urgencia <= 1 && (!registroCompra[p.sku] || registroCompra[p.sku].cantidad === 0));

    if (pendientes.length > 0) {
      const nombres = pendientes.slice(0, 5).map(p => `- ${p.nombre}`).join('\n');
      const msg = `⚠️ ¡HUGO!\nFaltan ${pendientes.length} agotados/críticos:\n${nombres}${pendientes.length > 5 ? '\n...y otros' : ''}\n\n¿Finalizar de todos modos?`;
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
      alert("✅ ¡ÉXITO! Tienda sincronizada.");
      onBack();
    } catch (e) { alert("Error."); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white">
      
      {/* HEADER TÁCTICO */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-black uppercase">Atrás</button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase italic tracking-tighter">Hugo <span className="text-green-500">Master</span></h2>
          <p className="text-[7px] text-gray-500 font-bold tracking-widest">CENTRAL DE ABASTOS</p>
        </div>
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-black font-black text-[10px]">🛒</div>
      </div>

      {/* BARRA DE BÚSQUEDA Y COBERTURA */}
      <div className="p-3 bg-[#050505] border-b border-white/5 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input 
            type="text"
            placeholder="BUSCAR ARTÍCULO (EJ. LIMÓN)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold text-green-500 uppercase outline-none focus:border-green-500/50 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              <X size={16} />
            </button>
          )}
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

      {/* LISTADO DINÁMICO */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        {categoriesOrdered.length === 0 && (
            <div className="text-center p-10 text-gray-600 uppercase font-black text-xs">No hay coincidencias...</div>
        )}
        
        {categoriesOrdered.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const minUrg = Math.min(...items.map(i => i.urgencia));
          const colorCat = minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : 'bg-green-500';
          const isExpanded = expandedCategory === cat || searchTerm.length > 0; // Se expande solo si hay búsqueda

          return (
            <div key={cat} className={`rounded-[25px] border ${isExpanded ? 'bg-[#080808] border-white/10 shadow-xl' : 'border-white/5 opacity-80'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${colorCat} ${minUrg === 0 && 'animate-ping'}`}></div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest">{cat}</h3>
                </div>
                <ChevronDown size={14} className={`text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
              </button>

              {isExpanded && (
                <div className="px-3 pb-4 space-y-3">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, costo_central: item.costo, precio_venta: item.precio_venta, margen_actual: item.margenObjetivo };
                    const isAgotado = item.stock_actual === 0;
                    const isBajo = item.stock_actual > 0 && item.stock_actual <= 5;
                    const cardColor = isAgotado ? 'border-red-600/30 bg-red-600/[0.03]' : isBajo ? 'border-orange-500/30 bg-orange-500/[0.03]' : 'border-white/5 bg-white/[0.02]';

                    return (
                      <div key={item.sku} className={`p-4 rounded-[22px] border relative ${cardColor} ${item.activo === false && 'opacity-30 grayscale'}`}>
                        {/* TOGGLE TEMPORADA */}
                        <button onClick={() => toggleActivo(item.sku, item.activo)} className="absolute top-3 right-3 p-2 bg-black/50 rounded-full border border-white/5 active:scale-90 transition-all">
                          {item.activo !== false ? <Eye size={12} className="text-green-500"/> : <EyeOff size={12} className="text-red-500"/>}
                        </button>

                        <div className="flex justify-between items-start mb-3">
                          <div className="w-3/4">
                            <p className="text-[11px] font-black uppercase text-white leading-tight">{item.nombre}</p>
                            <p className="text-[7px] text-gray-500 font-bold uppercase mt-1">Ref: {formatCurrency(item.costo)}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-[8px] font-black uppercase ${isAgotado ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : isBajo ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                            {isAgotado ? 'AGOTADO' : `${item.stock_actual} ${item.unidad}`}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div className="relative">
                            <input 
                              type="number" value={data.cantidad || ''} 
                              onChange={(e) => setRegistroCompra({...registroCompra, [item.sku]: {...data, cantidad: parseFloat(e.target.value)}})}
                              placeholder={`Sug: ${item.sugerido}`}
                              className="w-full bg-black border border-white/10 rounded-xl py-3 px-3 text-lg font-black text-green-500 outline-none focus:border-green-500"
                            />
                            <button onClick={() => setRegistroCompra({...registroCompra, [item.sku]: {...data, cantidad: item.sugerido}})} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-green-500 active:scale-75"><Zap size={14} fill="currentColor"/></button>
                          </div>
                          <div className="bg-black border border-white/10 rounded-xl p-2 flex flex-col items-center justify-center">
                            <span className="text-[6px] text-gray-500 font-bold uppercase mb-0.5">Costo Central</span>
                            <div className="flex items-center">
                                <span className="text-[10px] text-gray-600 mr-0.5">$</span>
                                <input 
                                  type="number" value={data.costo_central} 
                                  onChange={(e) => setRegistroCompra({...registroCompra, [item.sku]: {...data, costo_central: parseFloat(e.target.value)}})}
                                  className="w-full bg-transparent text-center font-black text-white text-sm outline-none"
                                />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center px-2">
                           <p className="text-[7px] font-bold text-gray-500">VENTA SUG: <span className="text-white">{formatCurrency(data.precio_venta)}</span></p>
                           <p className="text-[7px] font-bold text-gray-500">MARGEN: <span className={data.margen_actual < item.margenObjetivo ? 'text-red-500' : 'text-green-500'}>{(data.margen_actual * 100).toFixed(0)}%</span></p>
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
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        <div className="flex justify-between items-center mb-4 px-2">
            <div>
               <p className="text-[8px] font-black text-gray-500 uppercase">Inversión Estimada</p>
               <p className="text-xl font-black text-white">{formatCurrency(Object.values(registroCompra).reduce((acc, curr) => acc + (curr.cantidad * (curr.costo_central || 0)), 0))}</p>
            </div>
            <div className="text-right">
               <p className="text-[8px] font-black text-gray-500 uppercase">Surtido</p>
               <p className="text-lg font-black text-green-500">{Object.values(registroCompra).filter(v => v.cantidad > 0).length} ITEMS</p>
            </div>
        </div>
        <button 
          onClick={ejecutarCompraMaestra}
          disabled={issubmitting}
          className="w-full bg-green-600 h-14 rounded-2xl text-black font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
        >
          {issubmitting ? 'Sincronizando...' : 'Finalizar Operación'}
        </button>
      </div>
    </div>
  );
}
