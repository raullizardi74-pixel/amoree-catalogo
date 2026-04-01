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
import { Search, Loader2 } from 'lucide-react';

function MainContent() {
  const { products, loading, error } = useProducts();
  const { isAdmin } = useAuth();
  
  // --- ESTADOS DE VISTA ---
  const [activeView, setActiveView] = useState<'store' | 'ruta' | 'reporte' | 'merma'>('store');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const isAdminPath = window.location.pathname === '/admin';

  // ✅ 1. PROTÉCTOR DE RUTA /ADMIN
  if (isAdminPath) {
    if (!isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Acceso Restringido 🔒</h2>
          <p className="text-gray-600">Solo administradores pueden entrar aquí.</p>
          <a href="/" className="mt-4 text-green-600 font-bold hover:underline">Volver a Amoree</a>
        </div>
      );
    }
    return <AdminOrders />;
  }

  // ✅ 2. RENDERIZADO DE MÓDULOS ESPECIALES (Hugo, Merma, Raúl)
  // Mantenemos el Header siempre arriba para que no se vea "negro" o vacío
  if (activeView !== 'store') {
    return (
      <div className="min-h-screen bg-gray-50">
        {activeView === 'ruta' && <RutaDeCompra onBack={() => setActiveView('store')} />}
        {activeView === 'reporte' && <ReporteExito onBack={() => setActiveView('store')} />}
        {activeView === 'merma' && <Mermas onBack={() => setActiveView('store')} />}
      </div>
    );
  }

  // ✅ 3. LÓGICA DE LA TIENDA
  const categories = useMemo(() => {
    if (!products) return ['Todos'];
    const unique = Array.from(new Set(products.map(p => p.categoria || 'Otros')));
    return ['Todos', ...unique.sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCategory = selectedCategory === 'Todos' || (p.categoria || 'Otros') === selectedCategory;
      const matchSearch = (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  return (
    <>
      {/* BARRA DE HERRAMIENTAS TITANIUM (Hugo, Merma, Raúl) */}
      {isAdmin && (
        <div className="bg-[#050505] p-3 border-b border-green-500/20 flex flex-wrap gap-2 justify-center sticky top-0 z-[60]">
          <button 
            onClick={() => setActiveView('ruta')} 
            className="bg-gray-800 text-white text-[8px] font-black px-4 py-2 rounded-full border border-white/5 uppercase flex items-center gap-2 active:scale-95 transition-all"
          >
            🚚 Hugo
          </button>
          <button 
            onClick={() => setActiveView('merma')} 
            className="bg-red-600 text-white text-[8px] font-black px-4 py-2 rounded-full hover:bg-red-500 uppercase flex items-center gap-2 active:scale-95 transition-all"
          >
            🗑️ Merma
          </button>
          <button 
            onClick={() => setActiveView('reporte')} 
            className="bg-green-600 text-black text-[8px] font-black px-4 py-2 rounded-full hover:bg-green-500 uppercase flex items-center gap-2 active:scale-95 transition-all"
          >
            📊 Raúl
          </button>
        </div>
      )}

      {/* SECCIÓN BÚSQUEDA Y CATEGORÍAS */}
      <div className="bg-white border-b border-gray-100 sticky top-0 sm:top-[53px] z-50 shadow-sm px-4 py-3 space-y-3">
          <div className="relative max-w-7xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="¿Qué estás buscando hoy?" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-gray-100 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-green-500 transition-all" 
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 max-w-7xl mx-auto">
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)} 
                className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  selectedCategory === cat ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
      </div>

      <main className="container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-3/4">
          {loading && (
            <div className="flex flex-col items-center py-20 opacity-20">
              <Loader2 className="animate-spin text-green-600 mb-2" size={32} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando Amoree...</p>
            </div>
          )}
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
