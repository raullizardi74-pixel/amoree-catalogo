import { useState } from 'react';
import Header from './components/Header';
import ProductCard from './components/ProductCard';
import ShoppingCart from './components/ShoppingCart';
import AdminOrders from './components/AdminOrders'; 
// --- 1. IMPORTAMOS LOS NUEVOS COMPONENTES ---
import RutaDeCompra from './components/RutaDeCompra';
import ReporteExito from './components/ReporteExito';
import Mermas from './components/Mermas'; // <--- NUEVA ADICIÓN TITANIUM
// --------------------------------------------
import { ShoppingCartProvider } from './context/ShoppingCartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useProducts } from './hooks/useProducts';

function MainContent() {
  const { products, loading, error } = useProducts();
  const { user } = useAuth();
  
  // --- 2. DEFINIMOS LAS "PANTALLAS" (ESTADOS) ---
  // Añadimos 'merma' a las opciones de vista
  const [activeView, setActiveView] = useState<'store' | 'ruta' | 'reporte' | 'merma'>('store');

  const isAdminPath = window.location.pathname === '/admin';
  const adminEmails = ['raullizardi74@gmail.com'];
  const isAuthorized = user && adminEmails.includes(user.email || '');

  // --- 3. LÓGICA DE NAVEGACIÓN TÁCTICA ---

  // A. Si estamos en /admin, mostramos las órdenes
  if (isAdminPath) {
    if (!isAuthorized) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Restringido 🔒</h2>
          <p className="text-gray-600">Lo sentimos, solo los administradores pueden entrar.</p>
          <a href="/" className="mt-4 text-green-600 font-bold hover:underline">Volver a la tienda</a>
        </div>
      );
    }
    return <AdminOrders />;
  }

  // B. Vista de REPORTE DE ÉXITO (Métricas de Raúl)
  if (activeView === 'reporte') {
    return <ReporteExito onBack={() => setActiveView('store')} />;
  }

  // C. Vista de RUTA DE COMPRA (Abasto Central)
  if (activeView === 'ruta') {
    return <RutaDeCompra onBack={() => setActiveView('store')} />;
  }

  // D. Vista de MERMAS (Auditoría de Desperdicio)
  if (activeView === 'merma') {
    return <Mermas onBack={() => setActiveView('store')} />;
  }

  // E. VISTA POR DEFECTO: LA TIENDA
  return (
    <>
      {/* BARRA DE HERRAMIENTAS EXCLUSIVA PARA RAÚL / ADMIN */}
      {isAuthorized && (
        <div className="bg-[#050505] p-4 border-b border-green-500/20 flex flex-wrap gap-3 justify-center">
          <button 
            onClick={() => setActiveView('ruta')}
            className="bg-gray-800 text-white text-[9px] font-black px-5 py-2.5 rounded-full border border-white/5 hover:bg-gray-700 transition-all uppercase tracking-widest flex items-center gap-2"
          >
            🚚 Ruta de Hugo
          </button>
          
          <button 
            onClick={() => setActiveView('merma')}
            className="bg-red-600 text-white text-[9px] font-black px-5 py-2.5 rounded-full hover:bg-red-500 transition-all uppercase tracking-widest shadow-lg shadow-red-900/20 flex items-center gap-2"
          >
            🗑️ Baja por Merma
          </button>

          <button 
            onClick={() => setActiveView('reporte')}
            className="bg-green-600 text-black text-[9px] font-black px-5 py-2.5 rounded-full hover:bg-green-500 transition-all uppercase tracking-widest shadow-lg shadow-green-900/20 flex items-center gap-2"
          >
            📊 Auditoría Raúl
          </button>
        </div>
      )}

      <main className="container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-3/4">
          {loading && <p className="text-center py-10 italic text-gray-500">Sincronizando con la Central...</p>}
          {error && <p className="text-red-500 text-center">Error de conexión.</p>}
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
    </>
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
