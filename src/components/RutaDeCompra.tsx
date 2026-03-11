import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  TrendingUp, Calendar, Zap, Calculator, 
  CheckCircle2, AlertTriangle, ArrowDownDaily, Target
} from 'lucide-react';

// --- CONFIGURACIÓN DE MÁRGENES MAESTROS ---
const OBJETIVOS_UTILIDAD: Record<string, number> = {
  'Frutas': 0.40,
  'Verduras': 0.30,
  'Hojas y tallos': 0.42,
  'Abarrotes': 0.30,
  'Cremería': 0.22,
  'Otros': 0.15
};

// Función de Redondeo a 0.50
const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const { cartItems, setCartItems } = useShoppingCart();
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
      const { data: prodData } = await supabase.from('productos').select('*').order('nombre');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: orderData } = await supabase.from('pedidos').select('detalle_pedido').eq('estado', 'Finalizado').gte('created_at', sevenDaysAgo.toISOString());
      
      if (prodData) setProducts(prodData);
      if (orderData) setSalesData(orderData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const analysis = useMemo(() => {
    return products.map(p => {
      let totalVendido = 0;
      salesData.forEach(order => {
        const item = order.detalle_pedido?.find((i: any) => (i.sku || i.SKU) === p.sku);
        if (item) totalVendido += item.quantity;
      });

      const promedioDiario = totalVendido / 7;
      const diasRestantes = promedioDiario > 0 ? p.stock_actual / promedioDiario : 99;
      const sugerido = Math.max(0, (promedioDiario * coverageDays) - p.stock_actual);
      const margenObjetivo = OBJETIVOS_UTILIDAD[p.categoria] || OBJETIVOS_UTILIDAD['Otros'];

      return { ...p, promedioDiario, diasRestantes, sugerido: Number(sugerido.toFixed(2)), margenObjetivo };
    });
  }, [products, salesData, coverageDays]);

  // --- LÓGICA DE ACTUALIZACIÓN DE CAMPOS ---
  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const current = prev[sku] || { 
        cantidad: 0, 
        costo_central: itemRef?.costo || 0, 
        precio_venta: itemRef?.precio_venta || 0,
        margen_actual: itemRef?.margenObjetivo || 0.15
      };
      
      let updated = { ...current, [field]: value };

      // Si cambia el costo o el margen, recalculamos el precio de venta sugerido y redondeado
      if (field === 'costo_central' || field === 'margen_actual') {
        const sugerido = updated.costo_central * (1 + updated.margen_actual);
        updated.precio_venta = redondearPrecio(sugerido);
      }

      return { ...prev, [sku]: updated };
    });
  };

  const ejecutarCompraMaestra = async () => {
    const itemsAComprar = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    if (itemsAComprar.length === 0) return;

    setIsSubmitting(true);
    try {
      for (const [sku, data] of itemsAComprar) {
        const prodOriginal = products.find(p => p.sku === sku);

        // 1. Registrar en Tabla Compras
        await supabase.from('compras').insert({
          producto_sku: sku,
          nombre_producto: prodOriginal.nombre,
          cantidad: data.cantidad,
          unidad: prodOriginal.unidad,
          costo_unitario: data.costo_central,
          total_compra: data.cantidad * data.costo_central,
          proveedor: 'Central de Abastos'
        });

        // 2. ACTUALIZACIÓN MAESTRA: Tabla Productos
        await supabase.from('productos').update({
          costo: data.costo_central,
          precio_venta: data.precio_venta,
          stock_actual: prodOriginal.stock_actual + data.cantidad
        }).eq('sku', sku);
      }

      alert("🚀 ¡OPERACIÓN EXITOSA! Precios e Inventario actualizados en tienda.");
      onBack();
    } catch (e) {
      alert("Error en la actualización maestra.");
    } finally { setIsSubmitting(false); }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria || 'Otros')));

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-4 bg-[#050505] border-b border-white/10 flex justify-between items-center">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-xs font-bold">SALIR</button>
        <div className="text-center">
          <h2 className="text-sm font-black italic text-green-500 uppercase">Terminal de Compra</h2>
          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Central de Abastos</p>
        </div>
        <div className="bg-amber-500 text-black px-3 py-1 rounded-full text-[10px] font-black">HUGO</div>
      </div>

      {/* SELECTOR COBERTURA */}
      <div className="p-3 bg-black flex items-center justify-between border-b border-white/5 px-6">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Cobertura:</span>
        <div className="flex gap-1">
          {[2, 3, 5, 7].map(d => (
            <button key={d} onClick={() => setCoverageDays(d)} className={`px-4 py-2 rounded-xl text-[10px] font-black ${coverageDays === d ? 'bg-white text-black' : 'text-gray-500'}`}>{d}D</button>
          ))}
        </div>
      </div>

      {/* LISTA DE ARTÍCULOS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        {categories.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const isExpanded = expandedCategory === cat;

          return (
            <div key={cat} className="bg-[#080808] border border-white/5 rounded-[32px] overflow-hidden">
              <button onClick={() => setExpandedCategory(isExpanded ? null : cat)} className="w-full p-6 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-300">{cat}</h3>
                <span className="text-gray-600">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-6 space-y-6">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, costo_central: item.costo, precio_venta: item.precio_venta, margen_actual: item.margenObjetivo };
                    const esMargenBajo = data.margen_actual < item.margenObjetivo;

                    return (
                      <div key={item.sku} className="bg-[#111] border border-white/10 p-5 rounded-[28px] space-y-5 shadow-2xl">
                        
                        {/* 1. INFO Y MÉTRICAS */}
                        <div className="flex justify-between items-start">
                          <div className="w-2/3">
                            <p className="text-xs font-black uppercase text-white leading-tight">{item.nombre}</p>
                            <p className="text-[8px] text-gray-500 font-bold uppercase mt-1">Ref: {formatCurrency(item.costo)} (Amoree)</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-[8px] font-black px-2 py-1 rounded ${item.diasRestantes < 1.5 ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                              {item.diasRestantes.toFixed(1)}D STOCK
                            </span>
                          </div>
                        </div>

                        {/* 2. CANTIDAD (Input Numérico) */}
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="text-[7px] font-black text-gray-500 uppercase ml-2">Cantidad a comprar ({item.unidad})</label>
                            <div className="relative mt-1">
                              <input 
                                type="number" 
                                value={data.cantidad || ''} 
                                onChange={(e) => updateRegistro(item.sku, 'cantidad', parseFloat(e.target.value), item)}
                                className="w-full bg-black border border-white/10 rounded-2xl py-4 px-4 text-xl font-black text-green-500 outline-none focus:border-green-500"
                                placeholder={`Sugerido: ${item.sugerido}`}
                              />
                              <button 
                                onClick={() => updateRegistro(item.sku, 'cantidad', item.sugerido, item)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-green-500 text-black p-2 rounded-xl"
                              >
                                <Zap size={16} fill="currentColor" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 3. COSTO CENTRAL VS COSTO AMOREE */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/40 p-3 rounded-2xl border border-white/5">
                            <label className="text-[7px] font-black text-gray-500 uppercase block mb-2">Costo Central (Hoy)</label>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-600 font-bold text-xs">$</span>
                              <input 
                                type="number" 
                                value={data.costo_central || ''} 
                                onChange={(e) => updateRegistro(item.sku, 'costo_central', parseFloat(e.target.value), item)}
                                className="w-full bg-transparent text-lg font-black text-white outline-none"
                              />
                            </div>
                          </div>

                          {/* SELECTOR DE MARGEN DINÁMICO */}
                          <div className="bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col justify-center items-center">
                             <p className="text-[7px] font-black text-gray-500 uppercase mb-2">Margen Utilidad</p>
                             <div className="flex items-center gap-3">
                               <button onClick={() => updateRegistro(item.sku, 'margen_actual', data.margen_actual - 0.05, item)} className="text-gray-600 active:text-white"><Minus size={14}/></button>
                               <span className={`text-sm font-black ${esMargenBajo ? 'text-red-500' : 'text-green-500'}`}>
                                 {(data.margen_actual * 100).toFixed(0)}%
                               </span>
                               <button onClick={() => updateRegistro(item.sku, 'margen_actual', data.margen_actual + 0.05, item)} className="text-gray-600 active:text-white"><Plus size={14}/></button>
                             </div>
                             {esMargenBajo && <p className="text-[6px] text-red-500 font-black mt-1 animate-pulse tracking-tighter">DEBAJO DEL OBJETIVO ({item.margenObjetivo * 100}%)</p>}
                          </div>
                        </div>

                        {/* 4. PRECIO VENTA FINAL (Manual + Redondeado) */}
                        <div className="bg-gradient-to-r from-green-500/10 to-transparent p-4 rounded-2xl border border-green-500/20">
                          <label className="text-[7px] font-black text-green-500 uppercase flex items-center gap-1 mb-2">
                             <Target size={10}/> Precio Venta Final (Sugerido Redondeado)
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

      {/* FOOTER ACCIÓN MAESTRA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.9)]">
        <div className="flex justify-between items-center mb-4 px-2">
           <div>
             <p className="text-[10px] font-black text-gray-500 uppercase">Total Compra</p>
             <p className="text-2xl font-black text-white">
               {formatCurrency(Object.values(registroCompra).reduce((acc, curr) => acc + (curr.cantidad * curr.costo_central), 0))}
             </p>
           </div>
           <div className="text-right">
             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Items</p>
             <p className="text-xl font-black text-green-500">{Object.values(registroCompra).filter(v => v.cantidad > 0).length}</p>
           </div>
        </div>
        <button 
          onClick={ejecutarCompraMaestra}
          disabled={issubmitting}
          className="w-full bg-green-600 h-16 rounded-[24px] text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-green-900/20"
        >
          {issubmitting ? 'GUARDANDO CAMBIOS MAESTROS...' : 'Finalizar y Actualizar Tienda'}
        </button>
      </div>

    </div>
  );
}

// Iconos rápidos para UI
const Minus = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const Plus = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
