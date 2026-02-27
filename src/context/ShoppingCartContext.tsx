import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, Product } from '../types';

interface ShoppingCartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, step?: number) => void;
  removeFromCart: (sku: string) => void;
  decrementCartItem: (sku: string, step?: number) => void;
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

  const getItemQuantity = (sku: string) => {
    return cartItems.find(item => (item.sku || item.SKU) === sku)?.quantity || 0;
  };

  // ACTUALIZADO: Ahora acepta un "step" (ej. 0.25)
  const addToCart = (product: Product, step: number = 1) => {
    setCartItems(prevItems => {
      const productSku = product.sku || product.SKU;
      const existingItem = prevItems.find(item => (item.sku || item.SKU) === productSku);
      
      if (existingItem) {
        return prevItems.map(item =>
          (item.sku || item.SKU) === productSku 
            ? { ...item, quantity: Number((item.quantity + step).toFixed(2)) } 
            : item
        );
      }
      return [...prevItems, { ...product, quantity: step }];
    });
  };

  // ACTUALIZADO: Ahora resta por "step" y elimina si llega a 0
  const decrementCartItem = (sku: string, step: number = 1) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => (item.sku || item.SKU) === sku);
      
      if (!existingItem) return prevItems;

      const newQuantity = Number((existingItem.quantity - step).toFixed(2));

      if (newQuantity <= 0) {
        return prevItems.filter(item => (item.sku || item.SKU) !== sku);
      }

      return prevItems.map(item =>
        (item.sku || item.SKU) === sku ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  const removeFromCart = (sku: string) => {
    setCartItems(prevItems => prevItems.filter(item => (item.sku || item.SKU) !== sku));
  };

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
