import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Search, ShoppingCart, Plus, Minus, Camera, Save, X, Trash2, AlertCircle } from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showScanner, setShowScanner] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [tempSku, setTempSku] = useState('');
  const [newProd, setNewProd] = useState({ nombre: '', precio: '' });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    if (data) setProducts(data);
    setLoading(false);
  };

  // ✅ VALIDACIÓN DE STOCK AL AÑADIR
  const addToCart = (product: any) => {
    if (product.stock_actual <= 0) return; // Bloqueo si no hay nada

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        // Validar si ya llegamos al tope de stock
        if (existing.quantity >= product.stock_actual) return prev;
        
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  // ✅ VALIDACIÓN DE STOCK EN EL TICKET (BOTÓN +)
  const updateQuantity = (id: number, delta: number) => {
    const productRef = products.find(p => p.id === id);
    
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        
        // Si intenta subir y ya no hay stock disponible, bloqueamos
        if (delta > 0 && newQty > (productRef?.stock_actual || 0)) return item;
        
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handlePayment = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const { error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          vendedor: 'Terminal POS',
          total: total,
          estado: 'Finalizado',
          detalle_pedido: cart.map(item => ({
            id: item.id,
            sku: item.sku,
            nombre: item.nombre,
            quantity: item.quantity,
            price: item.precio_venta
          }))
        });

      if (errPedido) throw errPedido;

      for (const item of cart) {
        const productRef = products.find(p => p.id === item.id);
        const nuevoStock = Number(productRef?.stock_actual || 0) - Number(item.quantity);
        
        await supabase
          .from('productos')
          .update({ stock_actual: nuevoStock })
          .eq('id', item.id);
      }

      alert("🎉 Venta finalizada. Stock actualizado.");
      setCart([]);
      fetchProducts();
    } catch (e) {
      console.error(e);
      alert("Error al procesar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const filteredProducts = products.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.includes(searchTerm))
  );

  if (loading) return <div className="p-10 text-green-500 font-black">Sincronizando Terminal...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black">
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-colors">←</button>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Terminal <span className="text-green-500">POS</span></h2>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
            <input type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:border-green-500 font-bold" />
          </div>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg shadow-green-900/20"><Camera size={24} /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock_actual <= 0;
            return (
              <button 
                key={product.id} 
                onClick={() => !isOutOfStock && addToCart(product)} 
                className={`group relative bg-[#0A0A0A] border p-5 rounded-[30px] text-left transition-all overflow-hidden ${isOutOfStock ? 'border-red-900/50 cursor-not-allowed' : 'border-white/5 hover:border-green-500/30'}`}
              >
                {/* ✅ ALARMA VISUAL AGOTADO (image_7c2fc2) */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center rotate-[-10deg]">
                    <span className="bg-red-600 text-white font-black text-[10px] px-3 py-1 rounded-full shadow-lg border border-red-400">AGOTADO</span>
                  </div>
                )}

                <div className={isOutOfStock ? 'opacity-20' : ''}>
                  <p className="text-[9px] text-gray-500 uppercase font-black mb-1">{product.categoria}</p>
                  <p className="font-black text-white uppercase text-xs mb-4 leading-tight">{product.nombre}</p>
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-black">{formatCurrency(product.precio_venta)}</p>
                    <p className="text-[8px] text-gray-600 font-bold">STOCK: {product.stock_actual}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-[420px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 sticky top-6 shadow-2xl">
          <h3 className="font-black uppercase text-xs mb-8 flex items-center gap-2 italic">
            <ShoppingCart size={16} className="text-green-500" /> Ticket Actual
          </h3>
          
          <div className="space-y-4 mb-8 overflow-y-auto max-h-[45vh] no-scrollbar">
            {cart.map(item => {
              const reachedLimit = item.quantity >= item.stock_actual;
              return (
                <div key={item.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-white leading-tight mb-1">{item.nombre}</p>
                    <p className="text-[9px] text-gray-500 font-bold">{formatCurrency(item.precio_venta)} / {item.unidad}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-black rounded-xl p-1 border border-white/5">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-2 hover:text-red-500 transition-colors"><Minus size={14} /></button>
                    <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                    
                    {/* ✅ BOTÓN "+" QUE SE BLOQUEA Y PONE GRIS */}
                    <button 
                      onClick={() => updateQuantity(item.id, 1)} 
                      disabled={reachedLimit}
                      className={`p-2 transition-all ${reachedLimit ? 'text-gray-700 cursor-not-allowed' : 'text-green-500 hover:scale-110'}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {cart.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Carrito Vacío</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/10">
            <div className="flex justify-between items-end mb-8 px-2">
              <span className="text-[10px] text-gray-500 uppercase font-black">Total Ticket</span>
              <span className="text-4xl font-black text-white">{formatCurrency(total)}</span>
            </div>
            
            <button 
              disabled={cart.length === 0 || isSubmitting} 
              onClick={handlePayment}
              className={`w-full py-6 rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
                isSubmitting ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-green-500 hover:text-white shadow-green-900/10'
              }`}
            >
              {isSubmitting ? 'PROCESANDO...' : 'COBRAR AHORA'}
            </button>
          </div>
        </div>
      </div>

      {showScanner && <Scanner onScanSuccess={(text) => {
          const p = products.find(p => (p.sku === text || p.SKU === text));
          if (p) { 
            if(p.stock_actual > 0) {
              addToCart(p); 
              setShowScanner(false); 
            } else {
              alert("⚠️ PRODUCTO AGOTADO EN STOCK");
            }
          } else { alert("❌ No encontrado"); setShowScanner(false); }
      }} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
