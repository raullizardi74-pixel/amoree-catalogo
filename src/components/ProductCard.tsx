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
  
  // --- ESTADOS FINANCIEROS Y DE ALMACÉN (TITANIUM) ---
  const [newCosto, setNewCosto] = useState(product.costo || 0);
  const [newPrice, setNewPrice] = useState((product.precio_venta || 0).toString());
  const [compraHoy, setCompraHoy] = useState<number>(0);
  const [sugerido, setSugerido] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);
  
  const currentSku = product.sku || product.SKU || '';
  const quantity = getItemQuantity(currentSku);
  const MARGEN = 1.20; // 20% de utilidad estándar

  // Detector de Unidades Titanium
  const unitLabel = (() => {
    const n = product.nombre.toLowerCase();
    const pzaKeywords = ['pieza', 'lechuga', 'melón', 'sandía', 'coliflor', 'brócoli', 'piña', 'apio', 'pepino', 'coco', 'papaya'];
    const manojoKeywords = ['manojo', 'cilantro', 'perejil', 'espinaca', 'acelga', 'rábano', 'cebollita', 'epazote', 'hierbabuena'];
    
    if (pzaKeywords.some(k => n.includes(k))) return 'pza';
    if (manojoKeywords.some(k => n.includes(k))) return 'manojo';
    return 'kg';
  })();

  const step = unitLabel === 'kg' ? 0.25 : 1;

  // --- 1. MOTOR DE INTELIGENCIA: CÁLCULO DE SUGERIDO (3 DÍAS) ---
  useEffect(() => {
    if (isEditing && isAdmin) {
      fetchSalesAnalysis();
    }
  }, [isEditing]);

  const fetchSalesAnalysis = async () => {
    setLoadingStats(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('detalle_pedido')
        .eq('estado', 'Finalizado')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (pedidos) {
        let totalVendido = 0;
        let preciosHistoricos: number[] = [];

        pedidos.forEach(p => {
          const items = p.detalle_pedido as any[];
          const item = items.find(i => (i.sku || i.SKU) === currentSku);
          if (item) {
            totalVendido += item.quantity;
            preciosHistoricos.push(item.precio_venta);
          }
        });

        const promedioDiario = totalVendido / 7;
        let sugeridoBase = promedioDiario * 3; // Cobertura solicitada de 3 días

        // Lógica de elasticidad
        const precioPromedio = preciosHistoricos.reduce((a, b) => a + b, 0) / (preciosHistoricos.length || 1);
        const precioActual = parseFloat(newPrice);
        if (precioActual > precioPromedio * 1.1) sugeridoBase *= 0.8;
        else if (precioActual < precioPromedio * 0.9) sugeridoBase *= 1.2;

        setSugerido(Number(sugeridoBase.toFixed(2)));
      }
    } catch (e) {
      console.error("Error en análisis", e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleUpdateStockAndPrice = async () => {
    try {
      const { error: errorProd } = await supabase
        .from('productos')
        .update({ 
          costo: newCosto, 
          precio_venta: parseFloat(newPrice),
          stock_actual: (product.stock_actual || 0) + compraHoy
        })
        .eq('sku', currentSku);
        
      if (errorProd) throw errorProd;

      if (compraHoy > 0) {
        await supabase.from('compras').insert([{
          producto_sku: currentSku,
          nombre_producto: product.nombre,
          cantidad: compraHoy,
          unidad: unitLabel,
          costo_unitario: newCosto,
          total_compra: compraHoy * newCosto
        }]);
      }
      setIsEditing(false);
      window.location.reload(); 
    } catch (e) {
      alert('Error en la sincronización.');
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-md overflow-hidden border border-gray-100 flex flex-col h-full group transition-all hover:shadow-xl">
      {/* IMAGEN Y AGOTADO */}
      <div className="relative h-44 overflow-hidden">
        <img 
          src={product.url_imagen} 
          alt={product.nombre} 
          className="w-full h-full object-cover transition-transform group-hover:scale-110" 
          referrerPolicy="no-referrer"
        />
        
        {/*Badge de Stock Solo si es Agotado*/}
        {product.stock_actual !== undefined && product.stock_actual <= 0 && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest rotate-[-10deg] border-2 border-white shadow-2xl">
              Agotado
            </span>
          </div>
        )}

        {isAdmin && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="absolute top-4 right-4 bg-white text-black w-10 h-10 rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-10 border border-gray-100"
          >
            {isEditing ? '✕' : '⚙️'}
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-black text-gray-800 text-[13px] leading-tight mb-3 uppercase italic h-10 flex items-center">
          {product.nombre}
        </h3>
        
        <div className="mt-auto">
          {isEditing && isAdmin ? (
            /* --- PANEL DE EDICIÓN TITANIUM --- */
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <label className="text-[7px] font-black text-gray-400 uppercase block">Costo ($)</label>
                  <input 
                    type="number" value={newCosto} 
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      setNewCosto(v);
                      setNewPrice((v * MARGEN).toFixed(2));
                    }} 
                    className="w-full bg-transparent text-gray-800 font-black text-xs outline-none" 
                  />
                </div>
                <div className="bg-green-50 p-2 rounded-xl border border-green-100">
                  <label className="text-[7px] font-black text-green-600 uppercase block">Venta Sug.</label>
                  <input 
                    type="number" value={newPrice} 
                    onChange={(e) => setNewPrice(e.target.value)} 
                    className="w-full bg-transparent text-green-700 font-black text-xs outline-none" 
                  />
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                <div className="flex justify-between items-center mb-1">
                   <label className="text-[7px] font-black text-blue-600 uppercase">Entrada ({unitLabel})</label>
                   <span className="text-[7px] font-black text-gray-400 uppercase">Sug: {loadingStats ? "..." : sugerido}</span>
                </div>
                <input 
                  type="number" placeholder="0.00" 
                  onChange={(e) => setCompraHoy(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-blue-800 font-black text-lg outline-none" 
                />
              </div>
              <button onClick={handleUpdateStockAndPrice} className="w-full bg-gray-900 text-white font-black py-3 rounded-xl text-[9px] uppercase tracking-widest hover:bg-black transition-all">
                Sincronizar
              </button>
            </div>
          ) : (
            /* --- VISTA DE CLIENTE CON CORRECCIÓN DE ANCHO --- */
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-gray-900 tracking-tighter leading-none">
                  {formatCurrency(product.precio_venta)}
                </span>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Por {unitLabel}
                </span>
              </div>

              {/* SOLUCIÓN: min-w-[120px] para que los botones nunca se encimen o corten */}
              <div className="flex items-center bg-gray-100 rounded-2xl p-1 min-w-[120px] justify-center shadow-inner">
                {quantity === 0 ? (
                  <button
                    disabled={product.stock_actual !== undefined && product.stock_actual <= 0}
                    onClick={() => addToCart(product, step)}
                    className="bg-green-600 text-white font-black py-2.5 px-8 rounded-xl hover:bg-green-700 transition-all text-xs w-full disabled:bg-gray-300"
                  >
                    +
                  </button>
                ) : (
                  <div className="flex items-center justify-between w-full px-1">
                    <button
                      onClick={() => decrementCartItem(currentSku, step)}
                      className="bg-white text-gray-800 font-black h-8 w-8 rounded-lg shadow-sm active:scale-90 flex items-center justify-center border border-gray-200"
                    >
                      -
                    </button>
                    <span className="font-black text-gray-900 text-xs px-2">
                      {Number(quantity.toFixed(2))}
                    </span>
                    <button
                      onClick={() => addToCart(product, step)}
                      className="bg-white text-gray-800 font-black h-8 w-8 rounded-lg shadow-sm active:scale-90 flex items-center justify-center border border-gray-200"
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
