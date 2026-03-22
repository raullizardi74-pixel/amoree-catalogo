import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, Plus, Minus, Camera, X, 
  User, Phone, DollarSign, CreditCard, Smartphone, BookOpen, Send 
} from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // ✅ ESTADOS DE CLIENTE Y PAGO (RESTAURADOS)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'A Cuenta'>('Efectivo');

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

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  // ✅ LÓGICA DE TICKET WHATSAPP
  const enviarTicketWhatsApp = (nombre: string, telefono: string, metodo: string) => {
    const itemsText = cart.map(item => `- ${item.nombre} x${item.quantity}: ${formatCurrency(item.precio_venta * item.quantity)}`).join('%0A');
    const mensaje = `*¡HOLA ${nombre.toUpperCase()}!*%0A%0AGracias por tu compra en *AMOREE MARKET* 🥑%0A%0A*DETALLE DE TU COMPRA:*%0A${itemsText}%0A%0A*TOTAL:* ${formatCurrency(total)}%0A*FORMA DE PAGO:* ${metodo}%0A%0A¡Te esperamos pronto! 🚀`;
    
    // Formatear teléfono (quitar espacios/guiones)
    const telLimpio = telefono.replace(/\D/g, '');
    const url = `https://wa.me/52${telLimpio}?text=${mensaje}`;
    window.open(url, '_blank');
  };

  // ✅ FUNCIÓN DE COBRO TITANIUM (REGISTRA TODO)
  const finalizarVenta = async () => {
    if (cart.length === 0) return;
    if (!clientName.trim() || !clientPhone.trim()) return alert("Socio, el nombre y celular son necesarios para el ticket.");

    setIsSubmitting(true);
    try {
      // 1. Registrar Pedido en Supabase (Columnas exactas del CSV)
      const { error: errPedido } = await supabase
        .from('pedidos')
        .insert([{
          usuario_email: user?.email,
          nombre_cliente: clientName.toUpperCase(),
          telefono_cliente: clientPhone,
          total: total,
          estado: 'Finalizado',
          metodo_pago: metodoPago,
          pago_confirmado: metodoPago !== 'A Cuenta',
          vendedor: 'Terminal POS',
          origen: 'POS',
          detalle_pedido: cart.map(item => ({
            id: item.id,
            sku: item.sku,
            nombre: item.nombre,
            quantity: item.quantity,
            price: item.precio_venta
          }))
        }]);

      if (errPedido) throw errPedido;

      // 2. Descontar Stock
      for (const item of cart) {
        const pRef = products.find(p => p.id === item.id);
        await supabase.from('productos')
          .update({ stock_actual: (pRef?.stock_actual || 0) - item.quantity })
          .eq('id', item.id);
      }

      // 3. Disparar Ticket Digital
      enviarTicketWhatsApp(clientName, clientPhone, metodoPago);

      alert(`✅ Venta Exitosa. Ticket enviado a ${clientName}`);
      setCart([]);
      setShowPaymentModal(false);
      setClientName('');
      setClientPhone('');
      fetchProducts();
    } catch (e: any) {
      console.error(e);
      alert(`⚠️ Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-10 text-green-500 font-black animate-pulse">Iniciando POS Titanium...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl">←</button>
             <h2 className="text-3xl font-black uppercase italic italic tracking-tighter">Amoree <span className="text-green-500">Terminal</span></h2>
          </div>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg"><Camera size={24} /></button>
        </div>

        <input 
          type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-5 px-8 font-black uppercase outline-none focus:border-green-500 mb-8" 
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => {
            const isOut = product.stock_actual <= 0;
            return (
              <button key={product.id} onClick={() => !isOut && addToCart(product)} className={`relative bg-[#0A0A0A] border p-6 rounded-[35px] text-left transition-all ${isOut ? 'border-red-900/40 opacity-40' : 'border-white/5 hover:border-green-500/30'}`}>
                {isOut && <div className="absolute inset-0 flex items-center justify-center font-black text-red-500 text-[10px] uppercase">Agotado</div>}
                <p className="text-[9px] text-gray-600 uppercase font-black mb-1">{product.categoria}</p>
                <p className="font-black text-white uppercase text-xs mb-4 leading-tight">{product.nombre}</p>
                <div className="flex justify-between items-center"><p className="text-lg font-black">{formatCurrency(product.precio_venta)}</p><p className="text-[8px] text-gray-600">Stock: {product.stock_actual}</p></div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TICKET LATERAL */}
      <div className="w-full lg:w-[450px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[45px] p-10 sticky top-6 shadow-2xl">
          <h3 className="font-black uppercase text-xs mb-8 flex items-center gap-2 italic"><ShoppingCart size={18} className="text-green-500" /> Carrito Amoree</h3>
          
          <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-6">
                <div className="flex-1">
                  <p className="text-xs font-black uppercase text-white leading-tight mb-1">{item.nombre}</p>
                  <p className="text-[10px] text-gray-500 font-bold">{formatCurrency(item.precio_venta)}</p>
                </div>
                <div className="flex items-center gap-4 bg-black rounded-2xl p-2 border border-white/5">
                  <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                  <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-green-500"><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5">
            <div className="flex justify-between items-end mb-10"><span className="text-[10px] text-gray-500 uppercase font-black">Total Compra</span><span className="text-5xl font-black text-white">{formatCurrency(total)}</span></div>
            <button 
              disabled={cart.length === 0} 
              onClick={() => setShowPaymentModal(true)} 
              className="w-full py-7 rounded-[30px] font-black uppercase bg-white text-black hover:bg-green-500 transition-all text-sm tracking-widest shadow-xl"
            >
              Proceder al Cobro
            </button>
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE COBRO TITANIUM (CON TODO EL PODER) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in zoom-in-95">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-12 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X /></button>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-10">Cierre de <span className="text-green-500">Venta</span></h3>

            {/* DATOS DEL CLIENTE */}
            <div className="space-y-4 mb-10">
               <div className="relative">
                 <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                 <input type="text" placeholder="NOMBRE DEL CLIENTE" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-black border border-white/10 rounded-3xl py-5 pl-14 pr-6 font-black uppercase text-xs" />
               </div>
               <div className="relative">
                 <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                 <input type="tel" placeholder="CELULAR (10 DÍGITOS)" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-3xl py-5 pl-14 pr-6 font-black text-xs" />
               </div>
            </div>

            {/* MÉTODOS DE PAGO */}
            <div className="grid grid-cols-2 gap-3 mb-10">
              <button onClick={() => setMetodoPago('Efectivo')} className={`p-5 rounded-3xl border flex flex-col items-center gap-2 transition-all ${metodoPago === 'Efectivo' ? 'bg-green-600 border-green-600 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                <DollarSign size={20}/> <span className="font-black uppercase text-[9px]">Efectivo</span>
              </button>
              <button onClick={() => setMetodoPago('Tarjeta')} className={`p-5 rounded-3xl border flex flex-col items-center gap-2 transition-all ${metodoPago === 'Tarjeta' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                <CreditCard size={20}/> <span className="font-black uppercase text-[9px]">Tarjeta</span>
              </button>
              <button onClick={() => setMetodoPago('Transferencia')} className={`p-5 rounded-3xl border flex flex-col items-center gap-2 transition-all ${metodoPago === 'Transferencia' ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                <Smartphone size={20}/> <span className="font-black uppercase text-[9px]">SPEI</span>
              </button>
              <button onClick={() => setMetodoPago('A Cuenta')} className={`p-5 rounded-3xl border flex flex-col items-center gap-2 transition-all ${metodoPago === 'A Cuenta' ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                <BookOpen size={20}/> <span className="font-black uppercase text-[9px]">A Cuenta</span>
              </button>
            </div>

            <button 
              onClick={finalizarVenta} 
              disabled={isSubmitting}
              className="w-full py-7 bg-white text-black rounded-[30px] font-black uppercase tracking-[0.3em] text-[10px] hover:bg-green-500 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-3"
            >
              {isSubmitting ? 'REGISTRANDO...' : <>FINALIZAR Y ENVIAR TICKET <Send size={16}/></>}
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
