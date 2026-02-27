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
  const [newPrice, setNewPrice] = useState(product.precio_venta.toString());
  
  const quantity = getItemQuantity(product.sku);

  const handleUpdatePrice = async () => {
    try {
      const { error } = await supabase
        .from('productos')
        .update({ precio_venta: parseFloat(newPrice) })
        .eq('sku', product.sku);

      if (error) throw error;
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Hubo un error al guardar el precio.');
    }
  };

  // REGLA DE ORO: Incrementos siempre de 0.25, con o sin sesión.
  const handleIncrement = () => addToCart(product, 0.25);
  const handleDecrement = () => decrementCartItem(product.sku, 0.25);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
      <img src={product.url_imagen} alt={product.nombre} className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
      <div className="p-4">
        <h3 className="font-bold text-lg leading-tight h-12 flex items-center">{product.nombre}</h3>
        <p className="text-gray-500 text-sm font-semibold uppercase">{product.unidad}</p>
        
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="w-16 border rounded px-1 text-base font-bold" autoFocus />
                <button onClick={handleUpdatePrice} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded">OK</button>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="font-black text-lg text-green-700">{formatCurrency(product.precio_venta)}</span>
                {isAdmin && <button onClick={() => setIsEditing(true)} className="ml-1 p-1 text-blue-600 hover:bg-blue-50 rounded-full">✏️</button>}
              </div>
            )}
          </div>

          {/* AJUSTE PARA CELULAR: Más ancho y padding corregido */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {quantity === 0 ? (
              <button
                onClick={handleIncrement}
                className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors"
              >
                +
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={handleDecrement}
                  className="bg-white text-gray-700 font-black py-1 px-2.5 rounded-md border border-gray-200 active:bg-gray-300"
                >
                  -
                </button>
                
                {/* Visualización limpia del número */}
                <span className="font-bold text-gray-800 min-w-[35px] text-center text-xs">
                  {Number(quantity.toFixed(2))}
                </span>
                
                <button
                  onClick={addToCart(product, 0.25)}
                  className="bg-green-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-700 transition-colors"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
