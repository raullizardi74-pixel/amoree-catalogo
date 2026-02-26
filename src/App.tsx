/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Header from './components/Header';
import ProductCard from './components/ProductCard';
import ShoppingCart from './components/ShoppingCart';
import { ShoppingCartProvider } from './context/ShoppingCartContext';
import { AuthProvider } from './context/AuthContext';
import { useProducts } from './hooks/useProducts';

export default function App() {
  const { products, loading, error } = useProducts();

  return (
    <AuthProvider>
      <ShoppingCartProvider>
        <div className="bg-gray-100 min-h-screen font-sans">
          <Header />
          <main className="container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-3/4">
              {loading && <p>Cargando productos...</p>}
              {error && <p className="text-red-500">Error al cargar productos: {error.message}</p>}
              {!loading && !error && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {products.map(product => (
                    <ProductCard key={product.SKU} product={product} />
                  ))}
                </div>
              )}
            </div>
            <ShoppingCart />
          </main>
        </div>
      </ShoppingCartProvider>
    </AuthProvider>
  );
}
