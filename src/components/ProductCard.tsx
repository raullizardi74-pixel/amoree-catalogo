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
      alert('Hubo un error al guardar el precio. Intenta de nuevo.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
      <img 
        src={product.url_imagen} 
        alt={product.nombre} 
        className="w-full h-48 object-cover" 
        referrerPolicy="no-referrer" 
      />
      <div className="p-4">
        <h3 className="font-bold text-lg">{product.nombre}</h3>
        <p className="text-gray-500">{product.unidad}</p>
        
        <div className="flex justify-between items-center mt-4">
          {/* SECCIÓN DE PRECIO / EDITOR */}
          <div className="flex items-center">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-20 border rounded px-1 text-lg font-bold"
                  autoFocus
                />
                <button 
                  onClick={handleUpdatePrice} 
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                >
                  OK
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="font-bold text-xl">{formatCurrency(product.precio_venta)}</span>
                {isAdmin && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="ml-2 p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Editar precio"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN DE CARRITO */}
          <div className="flex items-center">
            {quantity === 0 ? (
              <button
                onClick={() => addToCart(product)}
                className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 transition-colors"
              >
                +
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decrementCartItem(product.sku)}
                  className="bg-gray-200 text-gray-700 font-bold py-1 px-3 rounded hover:bg-gray-300 transition-colors"
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  onClick={() => addToCart(product)}
                  className="bg-gray-200 text-gray-700 font-bold py-1 px-3 rounded hover:bg-gray-300 transition-colors"
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
