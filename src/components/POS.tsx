import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Search, ShoppingCart, Trash2, Plus, Minus, Camera, Save, X } from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE ESCÁNER Y REGISTRO RÁPIDO ---
  const [showScanner, setShowScanner] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [tempSku, setTempSku] = useState('');
  const [newProd, setNewProd] = useState({ nombre: '', precio: '' });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    if (data) setProducts(data);
    setLoading(false);
  };

  // --- LÓGICA DE ESCANEO INTELIGENTE ---
  const handleScanSuccess = (decodedText: string) => {
    const product = products.find(p => p.sku === decodedText || p.SKU === decodedText);
    
    if (product) {
      addToCart(product);
      setShowScanner(false);
    } else {
      // SI NO EXISTE: Activar Registro Rápido
      setTempSku(decodedText);
      setShowScanner(false);
      setShowQuickRegister(true);
    }
  };

  // --- REGISTRO DE PRODUCTO NUEVO AL VUELO ---
  const saveQuickProduct = async () => {
    if (!newProd.nombre || !newProd.precio) return alert("Llena nombre y precio");

    const nuevoProducto = {
      nombre: newProd.nombre.toUpperCase(),
      precio_venta: parseFloat(newProd.precio),
      sku: tempSku,
      categoria: 'General',
      unidad: 'pza',
      activo: true,
      stock_actual: 0
    };

    const { data, error } = await supabase.from('productos').insert([nuevoProducto]).select();

    if (!error && data) {
      setProducts([...products, data[0]]); // Actualizar lista local
      addToCart(data[0]); // Meter al carrito
      setShowQuickRegister(false);
      setNewProd({ nombre: '', precio: '' });
      setTempSku('');
    } else {
      alert("Error al registrar: " + error?.message);
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

  if (loading) return <div className="p-10 text-green-500 font-black animate-pulse">Iniciando POS Titanium...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 relative">
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-gray-500 hover:text-white">←</button>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Terminal <span className="text-green-500">POS</span></h2>
        </div>

        <div className="flex gap-3 mb-8">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-2xl py-5 px-6 text-sm font-black uppercase outline-none focus:border-green-500"
          />
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-5 rounded-2xl text-white shadow-lg"><Camera size={24} /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <button key={product.id} onClick={() => addToCart(product)} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[30px] text-left hover:border-green-500/30 transition-all">
              <p className="text-[10px] font-black text-gray-500 mb-1 uppercase">{product.categoria}</p>
              <p className="font-black text-white uppercase italic leading-tight mb-4">{product.nombre}</p>
              <p className="text-xl font-black">{formatCurrency(product.precio_venta)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-[400px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 sticky top-24 shadow-2xl">
          <h3 className="font-black uppercase italic tracking-widest text-sm mb-8 flex items-center gap-2">
            <ShoppingCart className="text-green-500" size={18} /> Ticket
          </h3>
          <div className="space-y-6 mb-8 max-h-[50vh] overflow-y-auto">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-white">{item.nombre}</p>
                  <p className="text-[10px] text-gray-500">{formatCurrency(item.precio_venta)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1"><Minus size={14} /></button>
                  <span className="text-xs font-black">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-8">
            <div className="flex justify-between items-end mb-8">
              <span className="text-[10px] font-black text-gray-500 uppercase">Total</span>
              <span className="text-4xl font-black">{formatCurrency(total)}</span>
            </div>
            <button disabled={cart.length === 0} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest">Cobrar</button>
          </div>
        </div>
      </div>

      {/* MODAL DE ESCÁNER */}
      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}

      {/* MODAL DE REGISTRO RÁPIDO TITANIUM */}
      {showQuickRegister && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-10 w-full max-w-md relative shadow-[0_0_50px_rgba(34,197,94,0.1)]">
            <button onClick={() => setShowQuickRegister(false)} className="absolute top-8 right-8 text-gray-500"><X /></button>
            <h2 className="text-2xl font-black uppercase italic text-green-500 mb-2">Producto Nuevo</h2>
            <p className="text-[10px] font-black text-gray-500 uppercase mb-8">Código detectado: {tempSku}</p>
            
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase mb-2 block">Nombre del Producto</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newProd.nombre}
                  onChange={(e) => setNewProd({...newProd, nombre: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-black uppercase outline-none focus:border-green-500"
                  placeholder="Ej. COCA COLA 600ML"
                />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase mb-2 block">Precio de Venta</label>
                <input 
                  type="number" 
                  value={newProd.precio}
                  onChange={(e) => setNewProd({...newProd, precio: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-black uppercase outline-none focus:border-green-500"
                  placeholder="0.00"
                />
              </div>
              <button 
                onClick={saveQuickProduct}
                className="w-full bg-green-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] mt-4 flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Save size={18} /> Registrar y Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
