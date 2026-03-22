import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Search, ShoppingCart, Plus, Minus, Camera, X, CreditCard, DollarSign, Smartphone } from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // ✅ ESTADOS DE PAGO RESTAURADOS
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');

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
    const pRef = products.find(p => p.id === id);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (delta > 0 && newQty > (pRef?.stock_actual || 0)) return item;
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  // ✅ FUNCIÓN DE COBRO MAESTRA (SIN DESCOMPONER NADA)
  const finalizarVenta = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Insertar Pedido con todas las columnas del CSV
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert([{
          total: total,
          estado: 'Finalizado',
          metodo_pago: metodoPago,
          vendedor: 'Terminal POS',
          pago_confirmado: true,
          origen: 'POS',
          detalle_pedido: cart.map(item => ({
            id: item.id,
            sku: item.sku,
            nombre: item.nombre,
            quantity: item.quantity,
            price: item.precio_venta
          }))
        }])
        .select()
        .single();

      if (errPedido) throw errPedido;

      // 2. Descuento de Stock
      for (const item of cart) {
        const pRef = products.find(p => p.id === item.id);
        const nuevoStock = (pRef?.stock_actual || 0) - item.quantity;
        
        const { error: errStock } = await supabase
          .from('productos')
          .update({ stock_actual: nuevoStock })
          .eq('id', item.id);
        
        if (errStock) throw errStock;
      }

      alert(`✅ Venta por ${formatCurrency(total)} registrada en ${metodoPago}`);
      setCart([]);
      setShowPaymentModal(false);
      fetchProducts();
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ Error Crítico: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);
  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-10 text-green-500 font-black animate-pulse">Iniciando Terminal...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black animate-in fade-in duration-500">
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-all">←</button>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Terminal <span className="text-green-500">POS</span></h2>
        </div>

        <div className="flex gap-3 mb-6">
          <input 
            type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 px-6 font-bold uppercase outline-none focus:border-green-500" 
          />
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg"><Camera size={24} /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const out = product.stock_actual <= 0;
            return (
              <button key={product.id} onClick={() => !out && addToCart(product)} className={`relative bg-[#0A0A0A] border p-5 rounded-[30px] text-left transition-all ${out ? 'border-red-900/50 cursor-not-allowed' : 'border-white/5 hover:border-green-500/30'}`}>
                {out && <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center"><span className="bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-black">AGOTADO</span></div>}
                <p className="text-[9px] text-gray-500 uppercase font-black mb-1">{product.categoria}</p>
                <p className="font-black text-white uppercase text-xs mb-4 leading-tight">{product.nombre}</p>
                <div className="flex justify-between items-center"><p className="text-lg font-black">{formatCurrency(product.precio_venta)}</p><p className="text-[8px] text-gray-600 font-bold uppercase">Stock: {product.stock_actual}</p></div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-[420px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 sticky top-6 shadow-2xl">
          <h3 className="font-black uppercase text-xs mb-8 flex items-center gap-2 italic"><ShoppingCart size={16} className="text-green-500" /> Ticket</h3>
          
          <div className="space-y-4 mb-8 max-h-[45vh] overflow-y-auto no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black uppercase text-white w-1/2 leading-tight">{item.nombre}</p>
                <div className="flex items-center gap-3 bg-black rounded-xl p-1 border border-white/5">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-2"><Minus size={12} /></button>
                  <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.stock_actual} className={`p-2 ${item.quantity >= item.stock_actual ? 'text-gray-700' : 'text-green-500'}`}><Plus size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-white/10">
            <div className="flex justify-between items-end mb-8"><span className="text-[10px] text-gray-500 uppercase font-black">Total</span><span className="text-4xl font-black text-white">{formatCurrency(total)}</span></div>
            <button 
              disabled={cart.length === 0} 
              onClick={() => setShowPaymentModal(true)} 
              className="w-full py-6 rounded-3xl font-black uppercase bg-white text-black hover:bg-green-500 transition-all active:scale-95"
            >
              Cobrar
            </button>
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE PAGO TITANIUM (LA PARTE QUE FALTABA) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-10 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase italic italic tracking-tighter">¿Cómo paga <span className="text-green-500">el cliente?</span></h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-white"><X /></button>
            </div>

            <div className="space-y-3 mb-10">
              <button onClick={() => setMetodoPago('Efectivo')} className={`w-full p-6 rounded-3xl border flex items-center gap-4 transition-all ${metodoPago === 'Efectivo' ? 'bg-green-600 border-green-600 text-white' : 'bg-white/5 border-white/5 text-gray-400'}`}>
                <DollarSign /> <span className="font-black uppercase text-xs">Efectivo</span>
              </button>
              <button onClick={() => setMetodoPago('Tarjeta')} className={`w-full p-6 rounded-3xl border flex items-center gap-4 transition-all ${metodoPago === 'Tarjeta' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/5 text-gray-400'}`}>
                <CreditCard /> <span className="font-black uppercase text-xs">Tarjeta de Débito/Crédito</span>
              </button>
              <button onClick={() => setMetodoPago('Transferencia')} className={`w-full p-6 rounded-3xl border flex items-center gap-4 transition-all ${metodoPago === 'Transferencia' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/5 border-white/5 text-gray-400'}`}>
                <Smartphone /> <span className="font-black uppercase text-xs">Transferencia SPEI</span>
              </button>
            </div>

            <button 
              onClick={finalizarVenta} 
              disabled={isSubmitting}
              className="w-full py-6 bg-white text-black rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-green-500 transition-all shadow-xl"
            >
              {isSubmitting ? 'REGISTRANDO...' : `CONFIRMAR PAGO EN ${metodoPago.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}

      {showScanner && <Scanner onScanSuccess={(text) => {
          const p = products.find(p => (p.sku === text || p.SKU === text));
          if (p && p.stock_actual > 0) { addToCart(p); setShowScanner(false); }
          else { alert("Producto no disponible"); setShowScanner(false); }
      }} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
