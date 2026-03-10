import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { 
  Package, TrendingUp, Calendar, ShoppingCart, 
  Plus, Minus, ChevronDown, ChevronUp, Zap, Calculator 
} from 'lucide-react';

// Constantes de Margen por Categoría
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
  const [coverageDays, setCoverageDays] = useState(3);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Estados locales para los precios editables que Hugo ingresa en el campo
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
      
      const margen = MARGENES[p.categoria] || MARGENES['Otros'];
      
      return { ...p, promedioDiario, diasRestantes, sugerido, margen };
    });
  }, [products, salesData, coverageDays]);

  // Manejar cambio de costo y calcular precio venta sugerido
  const handleCostoChange = (sku: string, nuevoCosto: number, margen: number) => {
    const ventaSugerida = Number((nuevoCosto * (1 + margen)).toFixed(2));
    setPreciosNuevos(prev => ({
      ...prev,
      [sku]: { costo: nuevoCosto, venta: ventaSugerida }
    }));
  };

  const ejecutarCompraMasiva = async () => {
    if (cartItems.length === 0) return;
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
          precio_venta_nuevo: nuevos?.venta || item.precio_venta || 0, // Nueva columna lógicamente necesaria
          total_compra: Number((item.quantity * (nuevos?.costo || item.costo || 0)).toFixed(2)),
          proveedor: 'Central de Abastos',
        };
      });

      const { error } = await supabase.from('compras').insert(payload);
      if (error) throw error;
      alert("✅ Compra y Precios registrados correctamente.");
      setCartItems([]);
      onBack();
    } catch (e) { alert("Error al guardar"); }
  };

  const categories = Array.from(new Set(products.map(p => p.categoria || 'Otros')));

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col text-white">
      {/* HEADER */}
      <div className="p-4 bg-[#080808] border-b border-white/10 flex justify-between items-center">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-lg">🔙</button>
        <h2 className="font-black italic text-green-500 tracking-tighter">HUGO - MODO CENTRAL</h2>
        <div className="text-[10px] bg-amber-500 text-black px-2 py-1 rounded font-bold uppercase">Abastos</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-44">
        {categories.map(cat => (
          <div key={cat} className="space-y-3">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] pl-2">{cat}</h3>
            {analysis.filter(p => (p.categoria || 'Otros') === cat).map(item => {
              const qty = getItemQuantity(item.sku);
              const step = item.unidad?.toLowerCase() === 'kg' ? 0.25 : 1;
              const precios = preciosNuevos[item.sku] || { costo: item.costo || 0, venta: item.precio_venta || 0 };

              return (
                <div key={item.sku} className="bg-[#111] border border-white/5 rounded-[24px] p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-white uppercase">{item.nombre}</p>
                    <div className="text-right">
                      <p className="text-[8px] text-gray-500 uppercase font-black">Stock Actual</p>
                      <p className="text-xs font-mono">{item.stock_actual.toFixed(1)} {item.unidad}</p>
                    </div>
                  </div>

                  {/* ZONA DE CARGA RÁPIDA */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                         // Borrar lo que haya y cargar exactamente el sugerido
                         const current = getItemQuantity(item.sku);
                         decrementCartItem(item.sku, current);
                         addToCart(item, item.sugerido);
                      }}
                      className="flex-1 bg-green-500/10 border border-green-500/20 py-3 rounded-xl flex items-center justify-center gap-2 group active:scale-95 transition-all"
                    >
                      <Zap size={14} className="text-green-500 fill-green-500" />
                      <div className="text-left">
                        <p className="text-[7px] font-black text-green-500 uppercase">Cargar Sugerido</p>
                        <p className="text-sm font-black text-white">{item.sugerido.toFixed(2)}</p>
                      </div>
                    </button>

                    <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
                      <button onClick={() => decrementCartItem(item.sku, step)} className="p-2 text-gray-400"><Minus size={16}/></button>
                      <span className="w-12 text-center font-bold text-lg">{qty}</span>
                      <button onClick={() => addToCart(item, step)} className="p-2 text-green-500"><Plus size={16}/></button>
                    </div>
                  </div>

                  {/* INPUTS DE REGISTRO DE PRECIOS (Lo que le faltaba a Hugo) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-gray-500 uppercase ml-1">Nuevo Costo Unit.</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">$</span>
                        <input 
                          type="number" 
                          placeholder="0.00"
                          value={precios.costo || ''}
                          onChange={(e) => handleCostoChange(item.sku, parseFloat(e.target.value), item.margen)}
                          className="w-full bg-black border border-white/10 rounded-xl py-2 pl-6 pr-2 text-xs font-bold text-white focus:border-amber-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-amber-500 uppercase ml-1 flex items-center gap-1">
                        <Calculator size={8}/> Venta Sugerida ({item.margen * 100}%)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">$</span>
                        <input 
                          type="number" 
                          value={precios.venta || ''}
                          onChange={(e) => setPreciosNuevos(prev => ({ ...prev, [item.sku]: { ...prev[item.sku], venta: parseFloat(e.target.value) }}))}
                          className="w-full bg-black border border-amber-500/30 rounded-xl py-2 pl-6 pr-2 text-xs font-black text-amber-500 focus:border-amber-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* FOOTER TOTALIZADOR */}
      {cartItems.length > 0 && (
        <div className="absolute bottom-6 left-4 right-4 bg-[#111] border border-white/10 p-6 rounded-[32px] shadow-2xl animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[9px] font-black text-gray-500 uppercase">Total Compra Estimada</p>
              <p className="text-3xl font-black text-white">{formatCurrency(cartTotal)}</p>
            </div>
            <p className="text-xs font-bold text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
              {cartItems.length} SKUs
            </p>
          </div>
          <button 
            onClick={ejecutarCompraMasiva}
            className="w-full bg-green-500 h-16 rounded-2xl text-black font-black uppercase tracking-widest text-xs shadow-lg shadow-green-500/20 active:scale-95 transition-all"
          >
            Finalizar y Actualizar Precios
          </button>
        </div>
      )}
    </div>
  );
}
