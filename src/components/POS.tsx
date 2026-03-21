import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Search, ShoppingCart, Plus, Minus, Camera, Save, X, Trash2 } from 'lucide-react';

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

  // ✅ FUNCIÓN DE COBRO REAL
  const handlePayment = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Registrar Pedido en Supabase
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

      // 2. Descontar Stock producto por producto
      for (const item of cart) {
        const productRef = products.find(p => p.id === item.id);
        const nuevoStock = (productRef?.stock_actual || 0) - item.quantity;
        
        await supabase
          .from('productos')
          .update({ stock_actual: nuevoStock })
          .eq('id', item.id);
      }

      alert("🎉 ¡Venta Registrada! Inventario actualizado.");
      setCart([]);
      fetchProducts(); // Refrescar stock en pantalla
    } catch (e) {
      console.error(e);
      alert("Error al procesar el pago.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const filteredProducts = products.filter(p =>
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.includes(searchTerm))
  );

  if (loading) return <div className="p-10 text-green-500 font-black">Cargando Terminal...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4">
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl">←</button>
          <h2 className="text-2xl font-black uppercase italic">Terminal <span className="text-green-500">POS</span></h2>
        </div>

        <div className="flex gap-3 mb-6">
          <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-green-500" />
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl"><Camera size={24} /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredProducts.map(product => (
            <button key={product.id} onClick={() => addToCart(product)} className="bg-[#0A0A0A] border border-white/5 p-5 rounded-[30px] text-left hover:border-green-500/30">
              <p className="text-[10px] text-gray-500 uppercase">{product.categoria}</p>
              <p className="font-black text-white uppercase text-xs mb-3">{product.nombre}</p>
              <div className="flex justify-between items-center">
                <p className="text-lg font-black">{formatCurrency(product.precio_venta)}</p>
                <p className="text-[8px] text-gray-600">Stock: {product.stock_actual}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-[400px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 sticky top-6 shadow-2xl">
          <h3 className="font-black uppercase text-xs mb-6 flex items-center gap-2 italic">
            <ShoppingCart size={16} className="text-green-500" /> Detalle Ticket
          </h3>
          <div className="space-y-4 mb-8 overflow-y-auto max-h-[40vh] no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <p className="text-[10px] font-black uppercase">{item.nombre}</p>
                  <p className="text-[9px] text-gray-500">{formatCurrency(item.precio_venta)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1"><Minus size={12} /></button>
                  <span className="text-xs font-black">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-6 border-t border-white/10">
            <div className="flex justify-between items-end mb-6">
              <span className="text-[10px] text-gray-500 uppercase">Total a Pagar</span>
              <span className="text-3xl font-black">{formatCurrency(total)}</span>
            </div>
            <button 
              disabled={cart.length === 0 || isSubmitting} 
              onClick={handlePayment}
              className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isSubmitting ? 'bg-gray-800 text-gray-500' : 'bg-white text-black hover:bg-green-500 hover:text-white'}`}
            >
              {isSubmitting ? 'Registrando...' : 'Cobrar Ticket'}
            </button>
          </div>
        </div>
      </div>
      {showScanner && <Scanner onScanSuccess={(text) => {
          const p = products.find(p => p.sku === text);
          if (p) { addToCart(p); setShowScanner(false); }
          else { alert("Producto no encontrado"); setShowScanner(false); }
      }} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
