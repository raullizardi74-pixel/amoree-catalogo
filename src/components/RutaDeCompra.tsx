import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  TrendingUp, Zap, Target, Minus, Plus, 
  ChevronDown, ChevronUp, Clock, AlertTriangle, Save
} from 'lucide-react';

// --- CONFIGURACIÓN ESTRATÉGICA DE MÁRGENES ---
const OBJETIVOS_UTILIDAD: Record<string, number> = {
  'Frutas': 0.40,
  'Verduras': 0.30,
  'Hojas y tallos': 0.42,
  'Abarrotes': 0.30,
  'Cremería': 0.22,
  'Otros': 0.15
};

// Función de Redondeo a $0.50
const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const { setCartItems } = useShoppingCart();
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [coverageDays, setCoverageDays] = useState(3);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Estado Maestro de Compra: { sku: { cantidad, costo_central, precio_venta, margen_actual } }
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prodData } = await supabase.from('productos').select('*');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: orderData } = await supabase
        .from('pedidos')
        .select('detalle_pedido')
        .eq('estado', 'Finalizado')
        .gte('created_at', sevenDaysAgo.toISOString());
      
      if (prodData) setProducts(prodData);
      if (orderData) setSalesData(orderData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- MOTOR TITANIUM: ANÁLISIS, PRIORIDAD Y SUGERIDO ---
  const analysis = useMemo(() => {
    const rawData = products.map(p => {
      let totalVendido = 0;
      salesData.forEach(order => {
        const item = order.detalle_pedido?.find((i: any) => (i.sku || i.SKU) === p.sku);
        if (item) totalVendido += item.quantity;
      });

      const promedioDiario = totalVendido / 7;
      const diasRestantes = promedioDiario > 0 ? p.stock_actual / promedioDiario : 99;
      const sugerido = Math.max(0, (promedioDiario * coverageDays) - p.stock_actual);
      const margenObjetivo = OBJETIVOS_UTILIDAD[p.categoria] || OBJETIVOS_UTILIDAD['Otros'];

      return { 
        ...p, 
        promedioDiario, 
        diasRestantes, 
        sugerido: Number(sugerido.toFixed(2)), 
        margenObjetivo 
      };
    });

    // Ordenar artículos por urgencia (Menos días de stock primero)
    return rawData.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [products, salesData, coverageDays]);

  // --- ORDEN DE CATEGORÍAS POR SEMÁFORO (Lógica de Raúl) ---
  const categoriesOrdered = useMemo(() => {
    const cats = Array.from(new Set(analysis.map(p => p.categoria || 'Otros')));
    return cats.sort((a, b) => {
      const minA = Math.min(...analysis.filter(p => p.categoria === a).map(p => p.diasRestantes));
      const minB = Math.min(...analysis.filter(p => p.categoria === b).map(p => p.diasRestantes));
      return minA - minB;
    });
  }, [analysis]);

  // --- LÓGICA DE ACTUALIZACIÓN DINÁMICA ---
  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const current = prev[sku] || { 
        cantidad: 0, 
        costo_central: itemRef?.costo || 0, 
        precio_venta: itemRef?.precio_venta || 0,
        margen_actual: itemRef?.margenObjetivo || 0.15
      };
      
      let updated = { ...current, [field]: value };

      if (field === 'costo_central' || field === 'margen_actual') {
        const sugeridoBruto = updated.costo_central * (1 + updated.margen_actual);
        updated.precio_venta = redondearPrecio(sugeridoBruto);
      }
      return { ...prev, [sku]: updated };
    });
  };

  // --- ACTUALIZACIÓN MAESTRA (DB) ---
  const ejecutarCompraMaestra = async () => {
    const itemsAComprar = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    if (itemsAComprar.length === 0) return;

    setIsSubmitting(true);
    try {
      for (const [sku, data] of itemsAComprar) {
        const prodOriginal = products.find(p => p.sku === sku);

        // 1. Insertar en Compras
        await supabase.from('compras').insert({
          producto_sku: sku,
          nombre_producto: prodOriginal.nombre,
          cantidad: data.cantidad,
          unidad: prodOriginal.unidad,
          costo_unitario: data.costo_central,
          total_compra: data.cantidad * data.costo_central,
          proveedor: 'Central de Abastos'
        });

        // 2. Update Productos (Costo, Precio Venta y Stock)
        await supabase.from('productos').update({
          costo: data.costo_central,
          precio_venta: data.precio_venta,
          stock_actual: prodOriginal.stock_actual + data.cantidad
        }).eq('sku', sku);
      }
      alert("✅ ¡ÉXITO! Tienda actualizada.");
      onBack();
    } catch (e) { alert("Error en el registro."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-widest">Sincronizando Inventario Titanium...</div>;

  return (
    <div className="fixed inset-0 bg-[#000000] z-50 flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-4 bg-black border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-black tracking-widest uppercase">Salir</button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase italic tracking-tighter">Hugo <span className="text-green-500">Abarrotes</span></h2>
          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Terminal Central de Abastos</p>
        </div>
        <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-black font-black text-xs shadow-lg shadow-green-900/20">🛒</div>
      </div>

      {/* SELECTOR DE COBERTURA */}
      <div className="p-3 bg-[#050505] border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
           <Clock size={12} className="text-gray-500" />
           <p className="text-[8px] font-black uppercase text-gray-400">Cobertura:</p>
        </div>
        <div className="flex bg-black p-1 rounded-2xl border border-white/5">
          {[2, 3, 5, 7].map(d => (
            <button key={d} onClick={() => setCoverageDays(d)} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${coverageDays === d ? 'bg-white text-black' : 'text-gray-500'}`}>{d}D</button>
          ))}
        </div>
      </div>

      {/* LISTA DE PRIORIDADES (Acordeones) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        {categoriesOrdered.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const minDays = Math.min(...items.map(i => i.diasRestantes));
          const isExpanded = expandedCategory === cat;
          const statusColor = minDays < 1.5 ? 'bg-red-500' : minDays < 3 ? 'bg-amber-500' : 'bg-green-500';

          return (
            <div key={cat} className={`rounded-[35px] border transition-all ${isExpanded ? 'bg-[#080808] border-white/10 shadow-2xl' : 'bg-transparent border-white/5'}`}>
              <button onClick={() => setExpandedCategory(isExpanded ? null : cat)} className="w-full p-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-3 h-3 rounded-full ${statusColor} ${minDays < 1.5 && 'animate-ping'}`}></div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em]">{cat}</h3>
                    <p className="text-[7px] text-gray-500 font-bold mt-0.5 uppercase tracking-widest">Stock Crítico: {minDays.toFixed(1)} días</p>
                  </div>
                </div>
                <span className="text-gray-600">{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-6 space-y-5 animate-in slide-in-from-top-2">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, costo_central: item.costo, precio_venta: item.precio_venta, margen_actual: item.margenObjetivo };
                    const esMargenBajo = data.margen_actual < item.margenObjetivo;

                    return (
                      <div key={item.sku} className={`p-5 rounded-[30px] border flex flex-col gap-4 ${item.diasRestantes < 1.5 ? 'bg-red-500/5 border-red-500/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' : 'bg-white/[0.02] border-white/5'}`}>
                        
                        {/* 1. INFO ARTÍCULO */}
                        <div className="flex justify-between items-start">
                          <div className="w-2/3">
                            <p className="text-[11px] font-black uppercase text-white leading-tight">{item.nombre}</p>
                            <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">Ref Amoree: {formatCurrency(item.costo)}</p>
                          </div>
                          <div className={`px-2 py-1 rounded-md text-[7px] font-black uppercase ${item.diasRestantes < 1.5 ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                            {item.diasRestantes.toFixed(1)} Días Stock
                          </div>
                        </div>

                        {/* 2. CANTIDAD (Input + Zap) */}
                        <div className="flex-1">
                          <label className="text-[7px] font-black text-gray-500 uppercase ml-2 mb-1 block">Cantidad a comprar ({item.unidad})</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              inputMode="decimal"
                              value={data.cantidad || ''} 
                              onChange={(e) => updateRegistro(item.sku, 'cantidad', parseFloat(e.target.value), item)}
                              className="w-full bg-black border border-white/10 rounded-2xl py-4 px-4 text-xl font-black text-green-500 outline-none focus:border-green-500 transition-colors"
                              placeholder={`Sugerido: ${item.sugerido}`}
                            />
                            <button 
                              onClick={() => updateRegistro(item.sku, 'cantidad', item.sugerido, item)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-black p-2 rounded-xl shadow-lg active:scale-90 transition-transform"
                            >
                              <Zap size={16} fill="currentColor" />
                            </button>
                          </div>
                        </div>

                        {/* 3. COSTO Y MARGEN */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/60 p-3 rounded-2xl border border-white/5">
                            <label className="text-[7px] font-black text-gray-500 uppercase block mb-1">Costo Central</label>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 font-bold text-xs">$</span>
                              <input 
                                type="number" 
                                inputMode="decimal"
                                value={data.costo_central || ''} 
                                onChange={(e) => updateRegistro(item.sku, 'costo_central', parseFloat(e.target.value), item)}
                                className="w-full bg-transparent text-lg font-black text-white outline-none"
                              />
                            </div>
                          </div>
                          <div className="bg-black/60 p-3 rounded-2xl border border-white/5 flex flex-col justify-center items-center relative overflow-hidden">
                             <p className="text-[7px] font-black text-gray-500 uppercase mb-1">Margen</p>
                             <div className="flex items-center gap-3">
                               <button onClick={() => updateRegistro(item.sku, 'margen_actual', data.margen_actual - 0.05, item)} className="text-gray-500 hover:text-white"><Minus size={14}/></button>
                               <span className={`text-sm font-black ${esMargenBajo ? 'text-red-500' : 'text-green-500'}`}>
                                 {(data.margen_actual * 100).toFixed(0)}%
                               </span>
                               <button onClick={() => updateRegistro(item.sku, 'margen_actual', data.margen_actual + 0.05, item)} className="text-gray-500 hover:text-white"><Plus size={14}/></button>
                             </div>
                             {esMargenBajo && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-red-500 animate-pulse"></div>}
                          </div>
                        </div>

                        {/* 4. VENTA FINAL (Actualización Maestra) */}
                        <div className="bg-gradient-to-r from-green-500/10 to-transparent p-4 rounded-2xl border border-green-500/20">
                          <label className="text-[7px] font-black text-green-500 uppercase flex items-center gap-1 mb-1">
                             <Target size={10}/> Precio Venta Sugerido (.50)
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-white">$</span>
                            <input 
                              type="number" 
                              value={data.precio_venta || ''} 
                              onChange={(e) => updateRegistro(item.sku, 'precio_venta', parseFloat(e.target.value), item)}
                              className="w-full bg-transparent text-3xl font-black text-white outline-none"
                            />
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

      {/* FOOTER DE ACCIÓN MASIVA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.9)]">
        <div className="flex justify-between items-end mb-4 px-2">
           <div>
             <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Inversión Total</p>
             <p className="text-2xl font-black text-white leading-none">
               {formatCurrency(Object.values(registroCompra).reduce((acc, curr) => acc + (curr.cantidad * curr.costo_central), 0))}
             </p>
           </div>
           <div className="text-right">
             <p className="text-[9px] font-black text-gray-500 uppercase">Items</p>
             <p className="text-xl font-black text-green-500">{Object.values(registroCompra).filter(v => v.cantidad > 0).length}</p>
           </div>
        </div>
        <button 
          onClick={ejecutarCompraMaestra}
          disabled={issubmitting}
          className="w-full bg-green-600 h-16 rounded-[24px] text-black font-black uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-green-900/20"
        >
          {issubmitting ? 'Sincronizando Tienda...' : <><Save size={18}/> Finalizar Operación</>}
        </button>
      </div>

    </div>
  );
}
