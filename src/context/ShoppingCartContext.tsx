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

  const getItemQuantity = (sku: string) => {
    return cartItems.find(item => item.SKU === sku)?.quantity || 0;
  };

  const addToCart = (product: Product) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.SKU === product.SKU);
      if (existingItem) {
        return prevItems.map(item =>
          item.SKU === product.SKU ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, { ...product, quantity: 1 }];
    });
  };

  const decrementCartItem = (sku: string) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.SKU === sku);
      if (existingItem?.quantity === 1) {
        return prevItems.filter(item => item.SKU !== sku);
      }
      return prevItems.map(item =>
        item.SKU === sku ? { ...item, quantity: item.quantity - 1 } : item
      );
    });
  };

  const removeFromCart = (sku: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.SKU !== sku));
  };

  const cartTotal = cartItems.reduce((total, item) => {
    return total + (item['$ VENTA'] * item.quantity);
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
