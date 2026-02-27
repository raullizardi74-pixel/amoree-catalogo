import { useState } from 'react';
import Header from './components/Header';
import ProductCard from './components/ProductCard';
import ShoppingCart from './components/ShoppingCart';
import AdminOrders from './components/AdminOrders'; 
import { ShoppingCartProvider } from './context/ShoppingCartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useProducts } from './hooks/useProducts';

function MainContent() {
  const { products, loading, error } = useProducts();
  const { user } = useAuth();
  
  // Detectamos la ruta actual
  const isAdminPath = window.location.pathname === '/admin';

  // CONFIGURACIÓN DE SEGURIDAD: Tu correo como administrador principal
  const adminEmails = ['raullizardi74@gmail.com'];
  const isAuthorized = user && adminEmails.includes(user.email || '');

  // Lógica de acceso al panel
  if (isAdminPath) {
    if (!isAuthorized) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Restringido 🔒</h2>
          <p className="text-gray-600">Lo sentimos, solo los administradores de Amoree pueden entrar aquí.</p>
          <a href="/" className="mt-4 text-green-600 font-bold hover:underline">Volver a la tienda</a>
        </div>
      );
    }
    return <AdminOrders />;
  }

  return (
    <main className="container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
      <div className="w-full lg:w-3/4">
        {loading && <p className="text-center py-10">Cargando frescos de Amoree...</p>}
        {error && <p className="text-red-500 text-center">Error al conectar con el inventario.</p>}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <ProductCard key={product.sku || product.SKU} product={product} />
            ))}
          </div>
        )}
      </div>
      <ShoppingCart />
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShoppingCartProvider>
        <div className="bg-gray-100 min-h-screen font-sans">
          <Header />
          <MainContent />
        </div>
      </ShoppingCartProvider>
    </AuthProvider>
  );
}
