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
  
  // Obtenemos la cantidad actual (que ahora puede ser decimal ej: 0.25)
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

  // LÓGICA DE INCREMENTO (Salta de 0.25 en 0.25)
  const handleIncrement = () => {
    // Si es el primer clic, agregamos 0.25
    if (quantity === 0) {
      addToCart(product, 0.25);
    } else {
      addToCart(product, 0.25);
    }
  };

  // LÓGICA DE DECREMENTO
  const handleDecrement = () => {
    decrementCartItem(product.sku, 0.25);
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
        <h3 className="font-bold text-lg leading-tight h-12 flex items-center">{product.nombre}</h3>
        <p className="text-gray-500 text-sm font-semibold uppercase">{product.unidad}</p>
        
        <div className="flex justify-between items-center mt-4">
          {/* SECCIÓN DE PRECIO / EDITOR */}
          <div className="flex items-center">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-20 border rounded px-1 text-lg font-bold outline-none border-blue-400"
                  autoFocus
                />
                <button 
                  onClick={handleUpdatePrice} 
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold"
                >
                  OK
                </button>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="font-black text-xl text-green-700">{formatCurrency(product.precio_venta)}</span>
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

          {/* SECCIÓN DE CARRITO CON FRACCIONES */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {quantity === 0 ? (
              <button
                onClick={handleIncrement}
                className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors shadow-md"
              >
                +
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDecrement}
                  className="bg-white text-gray-700 font-black py-1 px-3 rounded-md hover:bg-gray-200 transition-colors border border-gray-200"
                >
                  -
                </button>
                
                {/* Formateamos para que 0.50 se vea como 0.5 */}
                <span className="font-bold text-gray-800 min-w-[40px] text-center text-sm">
                  {Number(quantity.toFixed(2))}
                </span>
                
                <button
                  onClick={handleIncrement}
                  className="bg-white text-gray-700 font-black py-1 px-3 rounded-md hover:bg-gray-200 transition-colors border border-gray-200"
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
