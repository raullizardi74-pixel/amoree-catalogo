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
import { Search, Loader2, Truck, Trash2, BarChart3 } from 'lucide-react';

function MainContent() {
  const { products, loading, error } = useProducts();
  const { isAdmin } = useAuth();
  const [activeView, setActiveView] = useState<'store' | 'ruta' | 'reporte' | 'merma'>('store');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const isAdminPath = window.location.pathname === '/admin';

  // ✅ PROTÉCTOR DE RUTA /ADMIN (BUSINESS OS)
  if (isAdminPath) {
    if (!isAdmin) return <div className="p-20 text-center font-black">ACCESO RESTRINGIDO 🔒</div>;
    return <AdminOrders />;
  }

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* ✅ BARRA ADMIN TITANIUM (Siempre visible para el jefe) */}
      {isAdmin && (
        <div className="bg-[#050505] p-3 border-b border-green-500/20 flex flex-wrap gap-2 justify-center sticky top-[72px] sm:top-[80px] z-[60]">
          <button onClick={() => setActiveView('store')} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase transition-all ${activeView === 'store' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`}>🏪 Tienda</button>
          <button onClick={() => setActiveView('ruta')} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase flex items-center gap-2 transition-all ${activeView === 'ruta' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}><Truck size={12}/> Hugo</button>
          <button onClick={() => setActiveView('merma')} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase flex items-center gap-2 transition-all ${activeView === 'merma' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}><Trash2 size={12}/> Merma</button>
          <button onClick={() => setActiveView('reporte')} className={`px-4 py-2 rounded-full text-[8px] font-black uppercase flex items-center gap-2 transition-all ${activeView === 'reporte' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white'}`}><BarChart3 size={12}/> Raúl</button>
        </div>
      )}

      {/* CONTENIDO DINÁMICO */}
      <main className="flex-1">
        {activeView === 'store' ? (
          <>
            <div className="bg-white border-b border-gray-100 sticky top-[125px] sm:top-[133px] z-50 shadow-sm px-4 py-3 space-y-3">
              <div className="relative max-w-7xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="¿Qué buscas hoy?" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-100 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-7xl mx-auto pb-1">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{cat}</button>
                ))}
              </div>
            </div>

            <div className="container mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-3/4">
                {loading ? (
                  <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin text-green-600 mb-2" size={32} /><p className="text-[10px] font-black uppercase">Sincronizando...</p></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-32">
                    {filteredProducts.map(product => <ProductCard key={product.sku || product.SKU} product={product} />)}
                  </div>
                )}
              </div>
              <ShoppingCart />
            </div>
          </>
        ) : (
          <div className="bg-white min-h-screen">
            {activeView === 'ruta' && <RutaDeCompra onBack={() => setActiveView('store')} />}
            {activeView === 'reporte' && <ReporteExito onBack={() => setActiveView('store')} />}
            {activeView === 'merma' && <Mermas onBack={() => setActiveView('store')} />}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShoppingCartProvider>
        <MainContent />
      </ShoppingCartProvider>
    </AuthProvider>
  );
}
