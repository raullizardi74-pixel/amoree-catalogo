import { useState } from 'react';
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
  
  // Estados para la edición financiera
  const [newCosto, setNewCosto] = useState(product.costo || 0);
  const [newPrice, setNewPrice] = useState((product.precio_venta || 0).toString());
  
  const currentSku = product.sku || product.SKU || '';
  const quantity = getItemQuantity(currentSku);
  const MARGEN = 1.20; // 20% de utilidad

  // Calcula el precio de venta sugerido automáticamente
  const handleCostoChange = (valor: string) => {
    const costoNum = parseFloat(valor) || 0;
    setNewCosto(costoNum);
    // Sugerimos el precio de venta (Costo * 1.20)
    setNewPrice((costoNum * MARGEN).toFixed(2));
  };

  const handleUpdatePrice = async () => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ 
          costo: newCosto, 
          precio_venta: parseFloat(newPrice) 
        })
        .eq('sku', currentSku);
        
      if (error) throw error;
      setIsEditing(false);
      window.location.reload(); // Recarga para ver los cambios reflejados
    } catch (e) {
      alert('Error al guardar datos en la base de datos.');
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-md overflow-hidden transform hover:scale-[1.01] transition-all duration-300 border border-gray-100 flex flex-col h-full">
      {/* Imagen y botón de edición para Admin */}
      <div className="relative">
        <img 
          src={product.url_imagen} 
          alt={product.nombre} 
          className="w-full h-40 object-cover" 
          referrerPolicy="no-referrer" 
        />
        {isAdmin && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow-lg text-blue-600 hover:scale-110 transition-transform"
          >
            {isEditing ? '✕' : '✏️'}
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-black text-gray-800 text-sm leading-tight h-10 flex items-center mb-1 uppercase tracking-tighter">
          {product.nombre}
        </h3>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">
          Unidad: {product.unidad}
        </p>
        
        <div className="mt-auto">
          {isEditing && isAdmin ? (
            /* PANEL DE EDICIÓN (SOLO ADMIN) */
            <div className="bg-blue-50 p-3 rounded-2xl space-y-3 border border-blue-100">
              <div>
                <label className="text-[9px] font-black text-blue-800 uppercase block mb-1">Costo Real ($)</label>
                <input 
                  type="number" 
                  value={newCosto} 
                  onChange={(e) => handleCostoChange(e.target.value)} 
                  className="w-full border-0 rounded-xl px-3 py-2 font-bold text-xs shadow-sm outline-none" 
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-green-800 uppercase block mb-1">Venta Sugerida (+20%)</label>
                <input 
                  type="number" 
                  value={newPrice} 
                  onChange={(e) => setNewPrice(e.target.value)} 
                  className="w-full border-2 border-green-400 rounded-xl px-3 py-2 font-black text-green-700 text-xs shadow-sm outline-none" 
                />
              </div>
              <button 
                onClick={handleUpdatePrice}
                className="w-full bg-blue-600 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-widest hover:bg-blue-700"
              >
                Guardar Cambios
              </button>
            </div>
          ) : (
            /* VISTA NORMAL (CLIENTE) */
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-green-700 tracking-tighter">
                  {formatCurrency(product.precio_venta)}
                </span>
                {isAdmin && product.costo && (
                  <span className="text-[9px] font-bold text-gray-400 uppercase">
                    Costo: {formatCurrency(product.costo)}
                  </span>
                )}
              </div>

              {/* Controles de Carrito */}
              <div className="flex items-center bg-gray-100 rounded-2xl p-1">
                {quantity === 0 ? (
                  <button
                    onClick={() => addToCart(product, 0.25)}
                    className="bg-green-600 text-white font-black py-2 px-6 rounded-xl hover:bg-green-700 active:scale-95 transition-all text-xs"
                  >
                    +
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-1">
                    <button
                      onClick={() => decrementCartItem(currentSku, 0.25)}
                      className="bg-white text-gray-700 font-black py-1.5 px-3 rounded-lg border border-gray-200 shadow-sm active:scale-90"
                    >
                      -
                    </button>
                    <span className="font-black text-gray-800 min-w-[35px] text-center text-sm">
                      {Number(quantity.toFixed(2))}
                    </span>
                    <button
                      onClick={() => addToCart(product, 0.25)}
                      className="bg-white text-gray-700 font-black py-1.5 px-3 rounded-lg border border-gray-200 shadow-sm active:scale-90"
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
