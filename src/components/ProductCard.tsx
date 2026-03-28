import { useState, useEffect } from 'react';
import { Product } from '../types';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Settings, X, Plus, Minus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, decrementCartItem, getItemQuantity } = useShoppingCart();
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  const [newCosto, setNewCosto] = useState(product.costo || 0);
  const [newPrice, setNewPrice] = useState((product.precio_venta || 0).toString());
  const [compraHoy, setCompraHoy] = useState<number>(0);
  const [sugerido, setSugerido] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);
  
  const currentSku = product.sku || product.SKU || '';
  const quantity = getItemQuantity(currentSku);
  const MARGEN = 1.20;

  // ✅ FIX TITANIUM: Usamos la unidad REAL de tu base de datos (Supabase)
  const unitLabel = (product.unidad || product.Unidad || 'kg').toLowerCase();

  // ✅ FIX TITANIUM: Si es pza o manojo, el salto es de 1 en 1. Si es kg, es de 0.25.
  const step = (unitLabel === 'pza' || unitLabel === 'manojo') ? 1 : 0.25;

  useEffect(() => {
    if (isEditing && isAdmin) fetchSalesAnalysis();
  }, [isEditing]);

  const fetchSalesAnalysis = async () => {
    setLoadingStats(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: pedidos } = await supabase.from('pedidos').select('detalle_pedido').eq('estado', 'Finalizado').gte('created_at', sevenDaysAgo.toISOString());
      if (pedidos) {
        let totalVendido = 0;
        pedidos.forEach(p => {
          const items = p.detalle_pedido as any[];
          const item = items.find(i => (i.sku || i.SKU) === currentSku);
          if (item) totalVendido += item.quantity;
        });
        setSugerido(Number(((totalVendido / 7) * 3).toFixed(2)));
      }
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const handleUpdateStockAndPrice = async () => {
    try {
      await supabase.from('productos').update({ costo: newCosto, precio_venta: parseFloat(newPrice), stock_actual: (product.stock_actual || 0) + compraHoy }).eq('sku', currentSku);
      if (compraHoy > 0) {
        await supabase.from('compras').insert([{ producto_sku: currentSku, nombre_producto: product.nombre, cantidad: compraHoy, unidad: unitLabel, costo_unitario: newCosto, total_compra: compraHoy * newCosto }]);
      }
      setIsEditing(false);
      window.location.reload(); 
    } catch (e) { alert('Error de sincronización.'); }
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-gray-100 flex flex-col h-full group transition-all hover:shadow-lg relative">
      <div className="relative h-40 overflow-hidden shrink-0">
        <img src={product.url_imagen} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        {product.stock_actual !== undefined && product.stock_actual <= 0 && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-red-600 text-white text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest rotate-[-5deg] border border-white shadow-xl">Agotado</span>
          </div>
        )}
        {isAdmin && (
          <button onClick={() => setIsEditing(!isEditing)} className="absolute top-2 right-2 bg-white/90 backdrop-blur-md text-black w-8 h-8 rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-all z-10 border border-white/20">
            {isEditing ? <X size={14}/> : <Settings size={14}/>}
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-black text-gray-800 text-[10px] leading-tight mb-2 uppercase italic line-clamp-2 h-7">{product.nombre}</h3>
        
        <div className="mt-auto">
          {isEditing && isAdmin ? (
            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                  <label className="text-[6px] font-black text-gray-400 uppercase block">Costo</label>
                  <input type="number" value={newCosto} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setNewCosto(v); setNewPrice((v * MARGEN).toFixed(2)); }} className="w-full bg-transparent text-gray-800 font-black text-[10px] outline-none" />
                </div>
                <div className="bg-green-50 p-1.5 rounded-lg border border-green-100">
                  <label className="text-[6px] font-black text-green-600 uppercase block">Venta</label>
                  <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="w-full bg-transparent text-green-700 font-black text-[10px] outline-none" />
                </div>
              </div>
              <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                <label className="text-[6px] font-black text-blue-600 uppercase block">Entrada ({unitLabel})</label>
                <input type="number" placeholder="0.00" onChange={(e) => setCompraHoy(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-blue-800 font-black text-sm outline-none" />
              </div>
              <button onClick={handleUpdateStockAndPrice} className="w-full bg-black text-white font-black py-2 rounded-lg text-[8px] uppercase tracking-widest">Sincronizar</button>
            </div>
          ) : (
            <div className="flex justify-between items-end gap-2">
              <div className="flex flex-col">
                <span className="text-lg font-black text-gray-900 tracking-tighter leading-none">{formatCurrency(product.precio_venta)}</span>
                <span className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mt-1">Por {unitLabel}</span>
              </div>

              <div className="flex flex-col items-center bg-gray-100 rounded-xl p-1 gap-1 min-w-[40px]">
                {quantity === 0 ? (
                  <button
                    disabled={product.stock_actual !== undefined && product.stock_actual <= 0}
                    onClick={() => addToCart(product, step)}
                    className="bg-green-600 text-white font-black w-8 h-8 rounded-lg hover:bg-green-700 transition-all flex items-center justify-center shadow-sm disabled:bg-gray-300"
                  >
                    <Plus size={16} strokeWidth={3} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => addToCart(product, step)}
                      className="bg-white text-green-600 font-black h-7 w-7 rounded-lg shadow-sm active:scale-90 flex items-center justify-center border border-gray-200"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                    <span className="font-black text-gray-900 text-[10px] py-0.5">{Number(quantity.toFixed(2))}</span>
                    <button
                      onClick={() => decrementCartItem(currentSku, step)}
                      className="bg-white text-red-500 font-black h-7 w-7 rounded-lg shadow-sm active:scale-90 flex items-center justify-center border border-gray-200"
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
