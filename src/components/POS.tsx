import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner'; // 📸 Importamos tu nuevo componente
import { Search, ShoppingCart, Trash2, Plus, Minus, Camera } from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DEL ESCÁNER ---
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    if (data) setProducts(data);
    setLoading(false);
  };

  // --- LÓGICA DE ESCANEO ---
  const handleScanSuccess = (decodedText: string) => {
    // Buscamos el producto por SKU (ajustado para leer ambos formatos)
    const product = products.find(p => p.sku === decodedText || p.SKU === decodedText);
    
    if (product) {
      addToCart(product);
      setShowScanner(false);
      // Opcional: podrías agregar una pequeña vibración o sonido aquí
    } else {
      alert(`Producto no encontrado: ${decodedText}`);
    }
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const filteredProducts = products.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.includes(searchTerm))
  );

  if (loading) return <div className="p-10 text-green-500 font-black animate-pulse">CARGANDO TERMINAL...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      {/* SECCIÓN DE PRODUCTOS */}
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors">← Volver</button>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Terminal <span className="text-green-500">POS</span></h2>
        </div>

        {/* BARRA DE BÚSQUEDA + BOTÓN ESCÁNER */}
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-sm font-black uppercase outline-none focus:border-green-500/50 transition-all"
            />
          </div>
          
          {/* BOTÓN DE DISPARO (CÁMARA) */}
          <button 
            onClick={() => setShowScanner(true)}
            className="bg-green-600 hover:bg-green-500 text-white p-5 rounded-2xl shadow-lg shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center"
            title="Escanear Código"
          >
            <Camera size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[30px] text-left hover:border-green-500/30 transition-all group"
            >
              <p className="text-[10px] font-black text-gray-500 mb-1 uppercase tracking-widest">{product.categoria}</p>
              <p className="font-black text-white uppercase italic mb-4 leading-tight group-hover:text-green-500 transition-colors">{product.nombre}</p>
              <p className="text-xl font-black">{formatCurrency(product.precio_venta)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* CARRITO / TICKET */}
      <div className="w-full lg:w-[400px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 sticky top-24 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <ShoppingCart className="text-green-500" size={20} />
            <h3 className="font-black uppercase italic tracking-widest text-sm">Ticket de Venta</h3>
          </div>

          <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {cart.length === 0 ? (
              <p className="text-gray-600 text-[10px] font-black uppercase text-center py-10">El carrito está vacío</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-white mb-1">{item.nombre}</p>
                    <p className="text-[10px] text-gray-500">{formatCurrency(item.precio_venta)} / {item.unidad}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-black rounded-xl p-1 border border-white/5">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-red-500 transition-colors"><Minus size={14} /></button>
                    <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-green-500 transition-colors"><Plus size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/5 pt-8">
            <div className="flex justify-between items-end mb-8">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total a Pagar</span>
              <span className="text-4xl font-black text-white">{formatCurrency(total)}</span>
            </div>
            
            <button 
              disabled={cart.length === 0}
              className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-xl"
            >
              Cobrar Ahora
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DEL ESCÁNER */}
      {showScanner && (
        <Scanner 
          onScanSuccess={handleScanSuccess} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
}
