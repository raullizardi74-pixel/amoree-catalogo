import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  Package, 
  TrendingUp, 
  Calendar, 
  ShoppingCart, 
  Plus, 
  Minus, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const { addToCart, decrementCartItem, getItemQuantity, cartItems, cartTotal, setCartItems } = useShoppingCart();
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [coverageDays, setCoverageDays] = useState(3);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prodData } = await supabase.from('productos').select('*').order('nombre');
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: orderData } = await supabase
        .from('pedidos')
        .select('detalle_pedido')
        .eq('estado', 'Finalizado')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (prodData) setProducts(prodData);
      if (orderData) setSalesData(orderData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- MOTOR DE CÁLCULO TITANIUM ---
  const analysis = useMemo(() => {
    return products.map(p => {
      let totalVendido = 0;
      salesData.forEach(order => {
        const item = order.detalle_pedido?.find((i: any) => i.sku === p.sku);
        if (item) totalVendido += item.quantity;
      });

      const promedioDiario = totalVendido / 7;
      const diasRestantes = promedioDiario > 0 ? p.stock_actual / promedioDiario : 99;
      const sugerido = Math.max(0, (promedioDiario * coverageDays) - p.stock_actual);

      let prioridad: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      if (diasRestantes < 1.5) prioridad = 'ALTA';
      else if (diasRestantes < 3) prioridad = 'MEDIA';

      return {
        ...p,
        promedioDiario,
        diasRestantes,
        sugerido,
        prioridad
      };
    });
  }, [products, salesData, coverageDays]);

  // --- LÓGICA DE COMPRA A SUPABASE ---
  const ejecutarCompraMasiva = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);

    try {
      const payload = cartItems.map(item => ({
        producto_sku: item.sku || (item as any).SKU,
        nombre_producto: item.nombre,
        cantidad: item.quantity,
        unidad: item.unidad || 'pza',
        costo_unitario: item.costo || item.precio_venta || 0,
        total_compra: Number(((item.quantity) * (item.costo || item.precio_venta || 0)).toFixed(2)),
        proveedor: item.proveedor || 'Surtido General'
      }));

      const { error } = await supabase.from('compras').insert(payload);

      if (error) throw error;

      alert("🚀 ¡Pedido registrado con éxito!");
      setCartItems([]); // Limpiar carrito local
      onBack(); // Regresar
    } catch (err) {
      console.error("Error en compra:", err);
      alert("Error al procesar la compra en base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria || 'Otros')));

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-green-500 font-black uppercase tracking-[0.4em] text-[10px]">Calculando Ruta Titanium...</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#000000] z-50 flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-6 bg-[#050505] border-b border-white/5 flex items-center justify-between shadow-2xl">
        <button onClick={onBack} className="text-lg p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">🔙</button>
        <div className="text-center">
          <h2 className="text-sm font-black uppercase tracking-tighter italic">Ruta de <span className="text-green-500">Abasto</span></h2>
          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.3em]">Operación Directa</p>
        </div>
        <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
          <ShoppingCart size={18} className="text-green-500" />
        </div>
      </div>

      {/* SELECTOR DE COBERTURA */}
      <div className="p-4 bg-[#050505] border-b border-white/5 flex items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-gray-500" />
          <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Días a cubrir:</p>
        </div>
        <div className="flex bg-black p-1 rounded-2xl border border-white/5">
          {[2, 3, 5, 7].map(d => (
            <button 
              key={d} 
              onClick={() => setCoverageDays(d)}
              className={`px-5 py-2 rounded-xl text-[9px] font-black transition-all ${coverageDays === d ? 'bg-white text-black scale-105 shadow-lg' : 'text-gray-500'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DE ARTÍCULOS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-40">
        {categories.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const alertCount = items.filter(i => i.prioridad === 'ALTA').length;
          const isExpanded = expandedCategory === cat;

          return (
            <div key={cat} className="group">
              <button 
                onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                className={`w-full p-5 flex items-center justify-between rounded-[25px] transition-all border ${isExpanded ? 'bg-[#0A0A0A] border-white/10 shadow-2xl' : 'bg-transparent border-white/5 opacity-80'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${alertCount > 0 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-green-500'}`}></div>
                  <h3 className="text-xs font-black uppercase italic tracking-widest">{cat}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {alertCount > 0 && <span className="bg-red-600/20 text-red-500 text-[8px] font-black px-3 py-1 rounded-full border border-red-500/30">{alertCount} CRÍTICO</span>}
                  {isExpanded ? <ChevronUp size={16} className="text-gray-600"/> : <ChevronDown size={16} className="text-gray-600"/>}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 px-2 space-y-4 animate-in slide-in-from-top-4 duration-300">
                  {items.sort((a, b) => a.diasRestantes - b.diasRestantes).map(item => {
                    const qty = getItemQuantity(item.sku);
                    const isKg = item.unidad?.toLowerCase() === 'kg';
                    const step = isKg ? 0.25 : 1;

                    return (
                      <div key={item.sku} className="bg-[#0A0A0A] border border-white/5 p-5 rounded-[30px] flex flex-col gap-4 shadow-xl">
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[11px] font-black uppercase text-white mb-1">{item.nombre}</p>
                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Costo: {formatCurrency(item.costo)}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${
                            item.prioridad === 'ALTA' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                            item.prioridad === 'MEDIA' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
                          }`}>
                            {item.prioridad}
                          </div>
                        </div>

                        {/* MÉTRICAS */}
                        <div className="grid grid-cols-3 gap-2">
                          <MetricBox label="Existencia" value={`${item.stock_actual.toFixed(1)} ${item.unidad}`} icon={<Package size={10}/>} />
                          <MetricBox label="Venta/Día" value={`${item.promedioDiario.toFixed(2)}`} icon={<TrendingUp size={10}/>} />
                          <MetricBox label="Días Stock" value={`${item.diasRestantes.toFixed(1)}d`} color={item.diasRestantes < 1.5 ? 'text-red-500' : 'text-white'} />
                        </div>

                        {/* ACCIÓN DE COMPRA */}
                        <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${qty > 0 ? 'bg-green-500/5 border-green-500/30 shadow-inner' : 'bg-black border-white/5'}`}>
                          <div>
                            <p className="text-[7px] font-black text-gray-500 uppercase mb-1">Sugerido: <span className="text-green-500">{item.sugerido.toFixed(2)}</span></p>
                            <p className="text-xs font-black text-white">{formatCurrency((item.costo || 0) * qty)}</p>
                          </div>

                          <div className="flex items-center gap-4 bg-[#111] p-1.5 rounded-2xl border border-white/10">
                            <button 
                              onClick={() => decrementCartItem(item.sku, step)}
                              className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl active:scale-90 transition-transform"
                            >
                              <Minus size={16} className={qty > 0 ? 'text-white' : 'text-gray-700'} />
                            </button>
                            <span className="text-lg font-black min-w-[40px] text-center font-mono">
                              {qty}
                            </span>
                            <button 
                              onClick={() => addToCart(item, step)}
                              className="w-10 h-10 flex items-center justify-center bg-green-600 rounded-xl active:scale-90 transition-transform shadow-lg shadow-green-900/20"
                            >
                              <Plus size={16} className="text-black" />
                            </button>
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

      {/* FOOTER ACCIONABLE - CAPITALIZACIÓN DE DATOS */}
      {cartItems.length > 0 && (
        <div className="absolute bottom-6 left-6 right-6 bg-[#111111] border border-white/10 p-6 rounded-[35px] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-8">
          <div className="flex justify-between items-end mb-5">
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Inversión Total</p>
              <p className="text-3xl font-black text-white tracking-tighter">{formatCurrency(cartTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-gray-500 uppercase mb-1">SKUs Seleccionados</p>
              <p className="text-xl font-black text-green-500">{cartItems.length}</p>
            </div>
          </div>
          
          <button
            onClick={ejecutarCompraMasiva}
            disabled={issubmitting}
            className="w-full bg-white text-black h-16 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {issubmitting ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Confirmar Pedido en Supabase
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-componente de métricas para limpieza
function MetricBox({ label, value, icon, color = 'text-white' }: any) {
  return (
    <div className="bg-black/60 p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-1 mb-1 text-gray-600">
        {icon}
        <p className="text-[6px] uppercase font-black tracking-tighter">{label}</p>
      </div>
      <p className={`text-[10px] font-black ${color}`}>{value}</p>
    </div>
  );
}
