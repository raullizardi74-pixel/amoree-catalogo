import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '../types';

interface ShoppingCartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (sku: string) => void;
  decrementCartItem: (sku: string) => void;
  getItemQuantity: (sku: string) => number;
  cartTotal: number;
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const ShoppingCartContext = createContext<ShoppingCartContextType | undefined>(undefined);

export function useShoppingCart() {
  const context = useContext(ShoppingCartContext);
  if (context === undefined) {
    throw new Error('useShoppingCart must be used within a ShoppingCartProvider');
  }
  return context;
}

export function ShoppingCartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // CORREGIDO: Usamos sku en minúsculas
  const getItemQuantity = (sku: string) => {
    return cartItems.find(item => (item.sku || item.SKU) === sku)?.quantity || 0;
  };

  // CORREGIDO: Sincronizamos con los nombres de la base de datos
  const addToCart = (product: Product) => {
    setCartItems(prevItems => {
      const productSku = product.sku || product.SKU;
      const existingItem = prevItems.find(item => (item.sku || item.SKU) === productSku);
      
      if (existingItem) {
        return prevItems.map(item =>
          (item.sku || item.SKU) === productSku ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, { ...product, quantity: 1 }];
    });
  };

  const decrementCartItem = (sku: string) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => (item.sku || item.SKU) === sku);
      if (existingItem?.quantity === 1) {
        return prevItems.filter(item => (item.sku || item.SKU) !== sku);
      }
      return prevItems.map(item =>
        (item.sku || item.SKU) === sku ? { ...item, quantity: item.quantity - 1 } : item
      );
    });
  };

  const removeFromCart = (sku: string) => {
    setCartItems(prevItems => prevItems.filter(item => (item.sku || item.SKU) !== sku));
  };

  // LA CORRECCIÓN CLAVE: Multiplicar usando precio_venta
  const cartTotal = cartItems.reduce((total, item) => {
    const precio = item.precio_venta || item['$ VENTA'] || 0;
    return total + (precio * item.quantity);
  }, 0);

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    decrementCartItem,
    getItemQuantity,
    cartTotal,
    setCartItems,
  };

  return (
    <ShoppingCartContext.Provider value={value}>
      {children}
    </ShoppingCartContext.Provider>
  );
}
