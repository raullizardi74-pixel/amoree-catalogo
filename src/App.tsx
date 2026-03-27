import { useState, useMemo } from 'react';
import Header from './components/Header';
import ProductCard from './components/ProductCard';
import ShoppingCart from './components/ShoppingCart';
import AdminOrders from './components/AdminOrders'; 
import RutaDeCompra from './components/RutaDeCompra';
import ReporteExito from './components/ReporteExito';
import Mermas from './components/Mermas'; 
import { ShoppingCartProvider } from './context/ShoppingCartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useProducts } from './hooks/useProducts';

function MainContent() {
  const { products, loading, error } = useProducts();
  const { user } = useAuth();
  
  // --- ESTADOS DE VISTA Y FILTRADO ---
  const [activeView, setActiveView] = useState<'store' | 'ruta' | 'reporte' | 'merma'>('store');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const isAdminPath = window.location.pathname === '/admin';
  const adminEmails = ['raullizardi74@gmail.com'];
  const isAuthorized = user && adminEmails.includes(user.email || '');

  // ✅ 1. CEREBRO DE CATEGORÍAS: Extrae automáticamente lo que Hugo sube a Supabase
  const categories = useMemo(() => {
    if (!products) return ['Todos'];
    const unique = Array.from(new Set(products.map(p => p.categoria || 'Otros')));
    return ['Todos', ...unique.sort()];
  }, [products]);

  // ✅ 2. FILTRADO TÁCTICO: Mantiene la lista limpia
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Todos') return products;
    return products.filter(p => (p.categoria || 'Otros') === selectedCategory);
  }, [products, selectedCategory]);

  // --- LÓGICA DE NAVEGACIÓN ---
  if (isAdminPath) {
    if (!isAuthorized) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Restringido 🔒</h2>
          <p className="text-gray-600">Solo administradores pueden entrar.</p>
          <a href="/" className="mt-4 text-green-600 font-bold hover:underline">Volver a la tienda</a>
        </div>
      );
    }
    return <AdminOrders />;
  }

  if (activeView === 'reporte') return <ReporteExito onBack={() => setActiveView('store')} />;
  if (activeView === 'ruta') return <RutaDeCompra onBack={() => setActiveView('store')} />;
  if (activeView === 'merma') return <Mermas onBack={() => setActiveView('store')} />;

  return (
    <>
      {/* BARRA DE HERRAMIENTAS ADMIN (Sticky) */}
      {isAuthorized && (
        <div className="bg-[#050505] p-3 border-b border-green-500/20 flex flex-wrap gap-2 justify-center sticky top-0 z-[60]">
          <button onClick={() => setActiveView('ruta')} className="bg-gray-800 text-white text-[8px] font-black px-4 py-2 rounded-full border border-white/5 uppercase tracking-widest flex items-center gap-2">🚚 Hugo</button>
          <button onClick={() => setActiveView('merma')} className="bg-red-600 text-white text-[8px] font-black px-4 py-2 rounded-full hover:bg-red-500 uppercase tracking-widest flex items-center gap-2">🗑️ Merma</button>
          <button onClick={() => setActiveView('reporte')} className="bg-green-600 text-black text-[8px] font-black px-4 py-2 rounded-full hover:bg-green-500 uppercase tracking-widest flex items-center gap-2">📊 Raúl</button>
        </div>
      )}

      {/* ✅ 3. BARRA DE CATEGORÍAS (Diseño Móvil Optimizado) */}
      <div className="bg-white border-b border-gray-100 sticky top-0 sm:top-[53px] z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  selectedCategory === cat 
                  ? 'bg-green-600 text-white shadow-lg scale-105' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-3/4">
          {loading && (
            <div className="flex flex-col items-center py-20 animate-pulse">
              <Zap className="text-green-500 mb-4" size={32} />
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sincronizando Amoree...</p>
            </div>
          )}
          
          {error && <p className="text-red-500 text-center py-20 font-bold">Error de conexión.</p>}
          
          {!loading && !error && (
            <>
              {/* Contador de artículos actual */}
              <div className="mb-6 px-2 flex justify-between items-center border-l-2 border-green-500 pl-4">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-tighter text-gray-800">{selectedCategory}</h2>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{filteredProducts.length} Artículos encontrados</p>
                </div>
              </div>

              {/* ✅ 4. GRID DE DOBLE COLUMNA: Menos scroll, más visión */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {filteredProducts.map(product => (
                  <ProductCard key={product.sku || product.SKU} product={product} />
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-32 opacity-30">
                  <p className="text-sm italic font-serif">Esta sección está vacía por ahora...</p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Carrito de Compras */}
        <div className="w-full lg:w-1/4">
          <div className="sticky top-[120px]">
            <ShoppingCart />
          </div>
        </div>
      </main>
    </>
  );
}

// Icono auxiliar para el loader
function Zap({ className, size }: { className?: string, size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShoppingCartProvider>
        <div className="bg-gray-50 min-h-screen font-sans">
          <Header />
          <MainContent />
        </div>
      </ShoppingCartProvider>
    </AuthProvider>
  );
}
