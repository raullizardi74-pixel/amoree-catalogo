import { Product } from '../types';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, decrementCartItem, getItemQuantity } = useShoppingCart();
  const quantity = getItemQuantity(product.SKU);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
      <img src={product['IMAGEN URL']} alt={product.Artículo} className="w-full h-48 object-cover" referrerPolicy="no-referrer" />
      <div className="p-4">
        <h3 className="font-bold text-lg">{product.Artículo}</h3>
        <p className="text-gray-500">{product.Unidad}</p>
        <div className="flex justify-between items-center mt-4">
          <span className="font-bold text-xl">{formatCurrency(product['$ VENTA'])}</span>
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
                onClick={() => decrementCartItem(product.SKU)}
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
  );
}
