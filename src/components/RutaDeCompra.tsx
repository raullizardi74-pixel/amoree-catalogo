import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  Package, TrendingUp, Calendar, ShoppingCart, 
  Plus, Minus, ChevronDown, ChevronUp, Zap, 
  Calculator, AlertCircle, CheckCircle2 
} from 'lucide-react';

// --- CONFIGURACIÓN DE MÁRGENES ---
const MARGENES: Record<string, number> = {
  'Frutas y Verduras': 0.35,
  'Abarrotes': 0.20,
  'Cremería': 0.15,
  'Otros': 0.10
};

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const { addToCart, decrementCartItem, getItemQuantity, cartItems, cartTotal, setCartItems } = useShoppingCart();
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [coverageDays, setCoverageDays] = useState(3);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Estado para capturar precios en tiempo real
  const [preciosNuevos, setPreciosNuevos] = useState<Record<string, { costo: number, venta: number }>>({});

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

  // --- MOTOR DE CÁLCULO TITANIUM (VUELVE A LA VIDA) ---
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
      const margen = MARGENES[p.categoria] || MARGENES['Otros'];

      let prioridad: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      if (diasRestantes < 1.5) prioridad = 'ALTA';
      else if (diasRestantes < 3) prioridad = 'MEDIA';

      return { ...p, promedioDiario, diasRestantes, sugerido, margen, prioridad };
    });
  }, [products, salesData, coverageDays]);

  const handleCostoChange = (sku: string, nuevoCosto: number, margen: number) => {
    const ventaSugerida = Number((nuevoCosto * (1 + margen)).toFixed(2));
    setPreciosNuevos(prev => ({ ...prev, [sku]: { costo: nuevoCosto, venta: ventaSugerida } }));
  };

  const ejecutarCompraMasiva = async () => {
    if (cartItems.length === 0) return;
    setIsSubmitting(true);
    try {
      const payload = cartItems.map(item => {
        const sku = item.sku || (item as any).SKU;
        const nuevos = preciosNuevos[sku];
        return {
          producto_sku: sku,
          nombre_producto: item.nombre,
          cantidad: item.quantity,
          unidad: item.unidad,
          costo_unitario: nuevos?.costo || item.costo || 0,
          total_compra: Number((item.quantity * (nuevos?.costo || item.costo || 0)).toFixed(2)),
          proveedor: 'Central de Abastos',
          // Aquí puedes añadir el precio_venta_nuevo si ya creaste la columna
        };
      });

      const { error } = await supabase.from('compras').insert(payload);
      if (error) throw error;
      alert("🚀 Compra Registrada y Precios Actualizados");
      setCartItems([]);
      onBack();
    } catch (e) { alert("Error al guardar en Supabase"); } finally { setIsSubmitting(false); }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria || 'Otros')));

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.4em]">Calculando Ruta Titanium...</div>;

  return (
    <div className="fixed inset-0 bg-[#000000] z-50 flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER TÁCTICO */}
      <div className="p-4 bg-black border-b border-white/5 flex items-center justify-between">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl">🔙</button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase tracking-tighter italic">Hugo <span className="text-green-500">Abastos</span></h2>
          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Ruta de Compra Inteligente</p>
        </div>
        <div className="w-10"></div>
      </div>

      {/* SELECTOR DE COBERTURA */}
      <div className="p-3 bg-[#050505] border-b border-white/5 flex items-center justify-between px-6">
        <p className="text-[8px] font-black uppercase text-gray-400">Días a cubrir:</p>
        <div className="flex bg-black p-1 rounded-2xl border border-white/5">
          {[2, 3, 5, 7].map(d => (
            <button key={d} onClick={() => setCoverageDays(d)} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${coverageDays === d ? 'bg-white text-black' : 'text-gray-500'}`}>{d}d</button>
          ))}
        </div>
      </div>

      {/* LISTA DE ACORDEONES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        {categories.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const alertCount = items.filter(i => i.prioridad === 'ALTA').length;
          const isExpanded = expandedCategory === cat;

          return (
            <div key={cat} className="bg-[#0A0A0A] rounded-[30px] border border-white/5 overflow-hidden transition-all">
              <button onClick={() => setExpandedCategory(isExpanded ? null : cat)} className="w-full p-6 flex items-center justify-between active:bg-white/5">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${alertCount > 0 ? 'bg-red-500 animate-ping' : 'bg-green-500'}`}></div>
                  <h3 className="text-xs font-black uppercase italic tracking-widest">{cat}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {alertCount > 0 && <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full">{alertCount} URGENTE</span>}
                  <span className="text-gray-600">{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-6 space-y-4 animate-in slide-in-from-top-2">
                  {items.sort((a, b) => a.diasRestantes - b.diasRestantes).map(item => {
                    const qty = getItemQuantity(item.sku);
                    const step = item.unidad?.toLowerCase() === 'kg' ? 0.25 : 1;
                    const precios = preciosNuevos[item.sku] || { costo: item.costo || 0, venta: item.precio_venta || 0 };

                    return (
                      <div key={item.sku} className="bg-white/[0.02] border border-white/5 p-4 rounded-3xl flex flex-col gap-4">
                        {/* Info Básica */}
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black uppercase text-white mb-1">{item.nombre}</p>
                            <div className={`inline-block px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                              item.prioridad === 'ALTA' ? 'bg-red-500/20 text-red-500' : 
                              item.prioridad === 'MEDIA' ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'
                            }`}>{item.prioridad}</div>
                          </div>
                          <p className="text-[10px] font-mono font-bold text-gray-500">{item.sku}</p>
                        </div>

                        {/* Grid Métricas (Titanium Engine) */}
                        <div className="grid grid-cols-3 gap-2">
                          <Metric label="Stock" value={`${item.stock_actual.toFixed(1)} ${item.unidad}`} />
                          <Metric label="Venta/Día" value={item.promedioDiario.toFixed(1)} />
                          <Metric label="Días Stock" value={`${item.diasRestantes.toFixed(1)}d`} color={item.diasRestantes < 1.5 ? 'text-red-500' : 'text-white'} />
                        </div>

                        {/* Carga Rápida y Cantidad */}
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { const current = getItemQuantity(item.sku); decrementCartItem(item.sku, current); addToCart(item, item.sugerido); }}
                            className="flex-1 bg-green-500/10 border border-green-500/20 py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                          >
                            <Zap size={14} className="text-green-500 fill-green-500" />
                            <div className="text-left">
                              <p className="text-[7px] font-black text-green-500 uppercase">Sugerido</p>
                              <p className="text-xs font-black text-white">{item.sugerido.toFixed(2)}</p>
                            </div>
                          </button>

                          <div className="flex items-center bg-white/5 rounded-2xl border border-white/10 px-2">
                            <button onClick={() => decrementCartItem(item.sku, step)} className="p-2 text-gray-400"><Minus size={14}/></button>
                            <span className="w-10 text-center font-bold text-lg">{qty}</span>
                            <button onClick={() => addToCart(item, step)} className="p-2 text-green-500"><Plus size={14}/></button>
                          </div>
                        </div>

                        {/* Registro de Precios (NUEVO) */}
                        <div className="grid grid-cols-2 gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
                          <div>
                            <label className="text-[7px] font-black text-gray-500 uppercase ml-1">Nuevo Costo</label>
                            <input type="number" value={precios.costo || ''} onChange={(e) => handleCostoChange(item.sku, parseFloat(e.target.value), item.margen)} className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none" placeholder="$0.00" />
                          </div>
                          <div>
                            <label className="text-[7px] font-black text-amber-500 uppercase ml-1 flex items-center gap-1"><Calculator size={8}/> Venta Sugerida ({item.margen * 100}%)</label>
                            <input type="number" value={precios.venta || ''} onChange={(e) => setPreciosNuevos(prev => ({ ...prev, [item.sku]: { ...prev[item.sku], venta: parseFloat(e.target.value) }}))} className="w-full bg-black border border-amber-500/30 rounded-xl py-2 px-3 text-xs font-black text-amber-500 outline-none" />
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

      {/* FOOTER TOTALIZADOR */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6 bg-[#111] border border-white/10 p-6 rounded-[35px] shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase">Inversión Estimada</p>
              <p className="text-3xl font-black text-white leading-none">{formatCurrency(cartTotal)}</p>
            </div>
            <p className="text-xs font-bold text-green-500">{cartItems.length} SKUs</p>
          </div>
          <button onClick={ejecutarCompraMasiva} disabled={issubmitting} className="w-full bg-green-500 h-16 rounded-2xl text-black font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3">
            {issubmitting ? 'GUARDANDO...' : <><CheckCircle2 size={18}/> FINALIZAR COMPRA</>}
          </button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color = "text-white" }: any) {
  return (
    <div className="bg-black/40 p-2 rounded-xl border border-white/5 text-center">
      <p className="text-[6px] text-gray-600 uppercase font-black mb-1">{label}</p>
      <p className={`text-[9px] font-black ${color}`}>{value}</p>
    </div>
  );
}
