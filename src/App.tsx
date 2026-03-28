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
import { Search, Zap } from 'lucide-react'; // Icono de búsqueda

function MainContent() {
  const { products, loading, error } = useProducts();
  const { user } = useAuth();
  
  const [activeView, setActiveView] = useState<'store' | 'ruta' | 'reporte' | 'merma'>('store');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>(''); // ✅ ESTADO PARA BÚSQUEDA

  const isAdminPath = window.location.pathname === '/admin';
  const adminEmails = ['raullizardi74@gmail.com'];
  const isAuthorized = user && adminEmails.includes(user.email || '');

  const categories = useMemo(() => {
    if (!products) return ['Todos'];
    const unique = Array.from(new Set(products.map(p => p.categoria || 'Otros')));
    return ['Todos', ...unique.sort()];
  }, [products]);

  // ✅ FILTRADO DOBLE: Por Categoría Y por Buscador
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCategory = selectedCategory === 'Todos' || (p.categoria || 'Otros') === selectedCategory;
      const matchSearch = (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  if (activeView === 'reporte') return <ReporteExito onBack={() => setActiveView('store')} />;
  if (activeView === 'ruta') return <RutaDeCompra onBack={() => setActiveView('store')} />;
  if (activeView === 'merma') return <Mermas onBack={() => setActiveView('store')} />;

  return (
    <>
      {isAuthorized && (
        <div className="bg-[#050505] p-3 border-b border-green-500/20 flex flex-wrap gap-2 justify-center sticky top-0 z-[60]">
          <button onClick={() => setActiveView('ruta')} className="bg-gray-800 text-white text-[8px] font-black px-4 py-2 rounded-full border border-white/5 uppercase flex items-center gap-2">🚚 Hugo</button>
          <button onClick={() => setActiveView('merma')} className="bg-red-600 text-white text-[8px] font-black px-4 py-2 rounded-full hover:bg-red-500 uppercase flex items-center gap-2">🗑️ Merma</button>
          <button onClick={() => setActiveView('reporte')} className="bg-green-600 text-black text-[8px] font-black px-4 py-2 rounded-full hover:bg-green-500 uppercase flex items-center gap-2">📊 Raúl</button>
        </div>
      )}

      {/* ✅ SECCIÓN DE BÚSQUEDA Y CATEGORÍAS (STICKY) */}
      <div className="bg-white border-b border-gray-100 sticky top-0 sm:top-[53px] z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          
          {/* BARRA DE BÚSQUEDA */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="¿Qué estás buscando?" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-green-500 transition-all"
            />
          </div>

          {/* CHIPS DE CATEGORÍA */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  selectedCategory === cat ? 'bg-green-600 text-white shadow-md scale-105' : 'bg-gray-100 text-gray-400'
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
          {!loading && !error && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-32">
              {filteredProducts.map(product => (
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
        <div className="bg-gray-50 min-h-screen font-sans">
          <Header />
          <MainContent />
        </div>
      </ShoppingCartProvider>
    </AuthProvider>
  );
}
