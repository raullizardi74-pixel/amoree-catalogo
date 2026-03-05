import { useState, useEffect } from 'react';
import { Product } from '../types';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, decrementCartItem, getItemQuantity } = useShoppingCart();
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // --- ESTADOS FINANCIEROS Y DE ALMACÉN ---
  const [newCosto, setNewCosto] = useState(product.costo || 0);
  const [newPrice, setNewPrice] = useState((product.precio_venta || 0).toString());
  const [compraHoy, setCompraHoy] = useState<number>(0);
  const [sugerido, setSugerido] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);
  
  const currentSku = product.sku || product.SKU || '';
  const quantity = getItemQuantity(currentSku);
  const MARGEN = 1.20; // 20% de utilidad estándar

  // --- 1. MOTOR DE INTELIGENCIA: CÁLCULO DE SUGERIDO (3 DÍAS) ---
  useEffect(() => {
    if (isEditing && isAdmin) {
      fetchSalesAnalysis();
    }
  }, [isEditing]);

  const fetchSalesAnalysis = async () => {
    setLoadingStats(true);
    try {
      // Consultamos pedidos finalizados de los últimos 7 días
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('detalle_pedido, created_at')
        .eq('estado', 'Finalizado')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (pedidos) {
        let totalVendido = 0;
        let preciosHistoricos: number[] = [];

        pedidos.forEach(p => {
          const items = p.detalle_pedido as any[];
          const item = items.find(i => i.sku === currentSku);
          if (item) {
            totalVendido += item.quantity;
            preciosHistoricos.push(item.precio_venta);
          }
        });

        const promedioDiario = totalVendido / 7;
        let sugeridoBase = promedioDiario * 3; // Cobertura de 3 días

        // --- LÓGICA DE ELASTICIDAD PRECIO/VENTA ---
        const precioPromedio = preciosHistoricos.reduce((a, b) => a + b, 0) / (preciosHistoricos.length || 1);
        const precioActual = parseFloat(newPrice);

        if (precioActual > precioPromedio * 1.1) {
          sugeridoBase *= 0.8; // Precio caro: sugerimos 20% menos para evitar merma
        } else if (precioActual < precioPromedio * 0.9) {
          sugeridoBase *= 1.2; // Precio barato: sugerimos 20% más para aprovechar
        }

        setSugerido(Number(sugeridoBase.toFixed(2)));
      }
    } catch (e) {
      console.error("Error en análisis de ventas", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleUpdateStockAndPrice = async () => {
    try {
      // Sumamos la compra de hoy al stock actual
      const nuevoStock = (product.stock_actual || 0) + compraHoy;

      const { error } = await supabase
        .from('productos')
        .update({ 
          costo: newCosto, 
          precio_venta: parseFloat(newPrice),
          stock_actual: nuevoStock
        })
        .eq('sku', currentSku);
        
      if (error) throw error;
      setIsEditing(false);
      window.location.reload(); 
    } catch (e) {
      alert('Error al sincronizar inventario.');
    }
  };

  // Detector de Unidades Titanium
  const unitLabel = (() => {
    const n = product.nombre.toLowerCase();
    if (['pieza', 'lechuga', 'melón', 'apio'].some(k => n.includes(k))) return 'pza';
    if (['manojo', 'cilantro', 'perejil', 'espinaca'].some(k => n.includes(k))) return 'manojo';
    return 'kg';
  })();

  return (
    <div className="bg-[#0A0A0A] rounded-[40px] shadow-2xl overflow-hidden border border-white/5 flex flex-col h-full group transition-all duration-500 hover:border-green-500/30">
      
      {/* IMAGEN Y BADGE DE STOCK */}
      <div className="relative overflow-hidden h-44">
        <img 
          src={product.url_imagen} 
          alt={product.nombre} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <p className="text-[9px] font-black text-white uppercase tracking-widest">
            Stock: <span className={product.stock_actual && product.stock_actual < 5 ? "text-red-500" : "text-green-500"}>
              {product.stock_actual || 0} {unitLabel}
            </span>
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="absolute top-4 right-4 bg-white text-black w-10 h-10 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-10"
          >
            {isEditing ? '✕' : '⚙️'}
          </button>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-black text-white text-base leading-tight mb-2 uppercase tracking-tighter italic">
          {product.nombre}
        </h3>
        
        <div className="mt-auto">
          {isEditing && isAdmin ? (
            /* --- PANEL DE COMPRAS E INVENTARIO (TITANIUM ADMIN) --- */
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">Costo de Compra ($)</label>
                  <input 
                    type="number" 
                    value={newCosto} 
                    onChange={(e) => {
                       setNewCosto(parseFloat(e.target.value));
                       setNewPrice((parseFloat(e.target.value) * MARGEN).toFixed(2));
                    }} 
                    className="w-full bg-transparent text-white font-black text-sm outline-none" 
                  />
                </div>
                <div className="bg-green-500/5 p-3 rounded-2xl border border-green-500/10">
                  <label className="text-[8px] font-black text-green-500 uppercase block mb-1">Venta Sug. (+20%)</label>
                  <input 
                    type="number" 
                    value={newPrice} 
                    onChange={(e) => setNewPrice(e.target.value)} 
                    className="w-full bg-transparent text-green-400 font-black text-sm outline-none" 
                  />
                </div>
              </div>

              <div className="bg-blue-600/10 p-4 rounded-3xl border border-blue-500/20 relative">
                <label className="text-[8px] font-black text-blue-400 uppercase block mb-2">Entrada de Mercancía ({unitLabel})</label>
                <div className="flex items-center justify-between">
                  <input 
                    type="number" 
                    placeholder="0.00"
                    onChange={(e) => setCompraHoy(parseFloat(e.target.value) || 0)}
                    className="bg-transparent text-white font-black text-xl outline-none w-1/2" 
                  />
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-500 uppercase">Sugerido p/ 3 días</p>
                    <p className="text-sm font-black text-blue-400">
                      {loadingStats ? "..." : `${sugerido} ${unitLabel}`}
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleUpdateStockAndPrice}
                className="w-full bg-white text-black font-black py-4 rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:bg-green-500 hover:text-white transition-all shadow-xl"
              >
                Sincronizar Almacén
              </button>
            </div>
          ) : (
            /* VISTA CLIENTE TITANIUM */
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-white tracking-tighter">
                  {formatCurrency(parseFloat(newPrice))}
                </span>
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  Por {unitLabel}
                </span>
              </div>

              <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/10">
                {quantity === 0 ? (
                  <button
                    onClick={() => addToCart(product, unitLabel === 'kg' ? 0.5 : 1)}
                    className="bg-green-600 text-white font-black py-2 px-6 rounded-xl hover:bg-green-500 active:scale-95 transition-all text-xs"
                  >
                    +
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={() => decrementCartItem(currentSku, unitLabel === 'kg' ? 0.25 : 1)}
                      className="bg-black/40 text-white font-black py-1.5 px-3 rounded-lg border border-white/10 shadow-sm active:scale-90"
                    >
                      -
                    </button>
                    <span className="font-black text-white min-w-[35px] text-center text-sm">
                      {quantity}
                    </span>
                    <button
                      onClick={() => addToCart(product, unitLabel === 'kg' ? 0.25 : 1)}
                      className="bg-black/40 text-white font-black py-1.5 px-3 rounded-lg border border-white/10 shadow-sm active:scale-90"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
