import { useState } from 'react';
import { Product } from '../types';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, decrementCartItem, getItemQuantity } = useShoppingCart();
  const { isAdmin } = useAuth();
  
  const currentSku = product.sku || product.SKU || '';
  const quantity = getItemQuantity(currentSku);

  // Detector de Unidades
  const unitLabel = (() => {
    const n = product.nombre.toLowerCase();
    if (['pieza', 'lechuga', 'melón', 'apio'].some(k => n.includes(k))) return 'pza';
    if (['manojo', 'cilantro', 'perejil', 'espinaca'].some(k => n.includes(k))) return 'manojo';
    return 'kg';
  })();

  const step = unitLabel === 'kg' ? 0.25 : 1;

  return (
    <div className="bg-white rounded-[2rem] shadow-md overflow-hidden border border-gray-100 flex flex-col h-full group">
      <div className="relative">
        <img 
          src={product.url_imagen} 
          alt={product.nombre} 
          className="w-full h-40 object-cover" 
          referrerPolicy="no-referrer" 
        />
        {/* OBSERVACIÓN: SOLO MOSTRAR STOCK SI ESTÁ AGOTADO */}
        {product.stock_actual !== undefined && product.stock_actual <= 0 && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest rotate-[-10deg] border-2 border-white shadow-2xl">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-black text-gray-800 text-xs leading-tight mb-1 uppercase italic h-8 flex items-center">
          {product.nombre}
        </h3>
        
        <div className="mt-auto flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-xl font-black text-gray-900 tracking-tighter">
              {formatCurrency(product.precio_venta)}
            </span>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
              Por {unitLabel}
            </span>
          </div>

          {/* SOLUCIÓN OBSERVACIÓN 1: AJUSTE DE CONTROLES PARA QUE NO SE OCULTEN */}
          <div className="flex items-center bg-gray-100 rounded-2xl p-1 min-w-[100px] justify-center">
            {quantity === 0 ? (
              <button
                disabled={product.stock_actual <= 0}
                onClick={() => addToCart(product, step)}
                className="bg-green-600 text-white font-black py-2 px-6 rounded-xl hover:bg-green-700 transition-all text-xs w-full disabled:bg-gray-300"
              >
                +
              </button>
            ) : (
              <div className="flex items-center justify-between w-full gap-1">
                <button
                  onClick={() => decrementCartItem(currentSku, step)}
                  className="bg-white text-gray-800 font-black h-8 w-8 rounded-lg shadow-sm active:scale-90 flex items-center justify-center"
                >
                  -
                </button>
                <span className="font-black text-gray-900 text-xs px-1">
                  {Number(quantity.toFixed(2))}
                </span>
                <button
                  onClick={() => addToCart(product, step)}
                  className="bg-white text-gray-800 font-black h-8 w-8 rounded-lg shadow-sm active:scale-90 flex items-center justify-center"
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
