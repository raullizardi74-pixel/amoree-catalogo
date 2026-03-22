import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Search, ShoppingCart, Plus, Minus, Camera, X } from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    if (data) setProducts(data);
    setLoading(false);
  };

  const addToCart = (product: any) => {
    if (product.stock_actual <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_actual) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    const productRef = products.find(p => p.id === id);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (delta > 0 && newQty > (productRef?.stock_actual || 0)) return item;
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  // ✅ CORRECCIÓN PUNTO 3: Función de Cobro Robusta
  const handlePayment = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Registrar Pedido con estructura JSON limpia
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

      // 2. Actualizar stock uno por uno
      for (const item of cart) {
        const pRef = products.find(p => p.id === item.id);
        const stockActualizado = (pRef?.stock_actual || 0) - item.quantity;
        
        const { error: errStock } = await supabase
          .from('productos')
          .update({ stock_actual: stockActualizado })
          .eq('id', item.id);
          
        if (errStock) throw errStock;
      }

      alert("🎉 Venta confirmada. Stock actualizado.");
      setCart([]);
      fetchProducts();
    } catch (e: any) {
      console.error("Detalle Error POS:", e);
      alert(`⚠️ Error en Supabase: ${e.message || 'Error desconocido'}. Revisa los permisos RLS.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);
  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-10 text-green-500 font-black">Iniciando POS...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black">
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl">←</button>
          <h2 className="text-2xl font-black uppercase italic">Terminal <span className="text-green-500">POS</span></h2>
        </div>
        <div className="flex gap-3 mb-6">
          <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 px-6 font-bold" />
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl"><Camera size={24} /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock_actual <= 0;
            return (
              <button key={product.id} onClick={() => !isOutOfStock && addToCart(product)} className={`relative bg-[#0A0A0A] border p-5 rounded-[30px] text-left transition-all ${isOutOfStock ? 'border-red-900/50' : 'border-white/5 hover:border-green-500/30'}`}>
                {isOutOfStock && <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center"><span className="bg-red-600 text-white text-[10px] px-3 py-1 rounded-full">AGOTADO</span></div>}
                <p className="text-[9px] text-gray-500 uppercase font-black">{product.categoria}</p>
                <p className="font-black text-white uppercase text-xs mb-4">{product.nombre}</p>
                <div className="flex justify-between items-center"><p className="text-lg font-black">{formatCurrency(product.precio_venta)}</p><p className="text-[8px] text-gray-600">STOCK: {product.stock_actual}</p></div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="w-full lg:w-[420px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 sticky top-6">
          <h3 className="font-black uppercase text-xs mb-8 flex items-center gap-2 italic"><ShoppingCart size={16} className="text-green-500" /> Ticket</h3>
          <div className="space-y-4 mb-8 max-h-[45vh] overflow-y-auto no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black uppercase text-white w-1/2">{item.nombre}</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                  <span className="text-xs font-black">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.stock_actual} className={item.quantity >= item.stock_actual ? 'text-gray-700' : 'text-green-500'}><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-6 border-t border-white/10">
            <div className="flex justify-between items-end mb-8"><span className="text-[10px] text-gray-500 uppercase font-black">Total</span><span className="text-4xl font-black text-white">{formatCurrency(total)}</span></div>
            <button disabled={cart.length === 0 || isSubmitting} onClick={handlePayment} className="w-full py-6 rounded-3xl font-black uppercase bg-white text-black hover:bg-green-500">{isSubmitting ? 'PROCESANDO...' : 'COBRAR'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
