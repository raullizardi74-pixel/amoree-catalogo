import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, Plus, Minus, Camera, X, 
  User, DollarSign, CreditCard, Smartphone, BookOpen, Send, UserPlus, ShieldOff, UserCheck 
} from 'lucide-react';

export default function POS({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // ✅ ESTADOS DE PAGO Y PRIVACIDAD
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true); // Por defecto anónimo para rapidez
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newClientData, setNewClientData] = useState({ nombre: '', telefono: '' });
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'A Cuenta'>('Efectivo');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: p } = await supabase.from('productos').select('*').eq('activo', true);
    const { data: c } = await supabase.from('clientes').select('*').order('nombre');
    if (p) setProducts(p);
    if (c) setClientes(c);
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
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        const pRef = products.find(p => p.id === id);
        if (delta > 0 && newQty > (pRef?.stock_actual || 0)) return item;
        return { ...item, quantity: Math.max(0, newQty) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const finalizarVenta = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      let clienteFinal = { nombre: 'PÚBLICO GENERAL', telefono: '', id: null, saldo: 0 };

      // 1. Si NO es anónimo, procesar cliente
      if (!isAnonymous) {
        if (isAddingNewClient) {
          const { data: nCl, error: nClErr } = await supabase
            .from('clientes')
            .insert([{ nombre: newClientData.nombre.toUpperCase(), telefono: newClientData.telefono, saldo: 0 }])
            .select().single();
          if (nClErr) throw nClErr;
          clienteFinal = nCl;
        } else if (selectedClient) {
          clienteFinal = selectedClient;
        } else {
          throw new Error("Selecciona un cliente o usa el modo Anónimo");
        }
      }

      // 2. Lógica de Saldo (Solo si hay cliente real y es A Cuenta)
      let nuevoSaldo = Number(clienteFinal.saldo || 0);
      if (metodoPago === 'A Cuenta' && !isAnonymous && clienteFinal.id) {
        nuevoSaldo += total;
        await supabase.from('clientes').update({ saldo: nuevoSaldo }).eq('id', clienteFinal.id);
      }

      // 3. Registrar Pedido
      const { error: errPedido } = await supabase.from('pedidos').insert([{
        usuario_email: user?.email,
        nombre_cliente: clienteFinal.nombre,
        telefono_cliente: clienteFinal.telefono,
        cliente_id: clienteFinal.id,
        total: total,
        estado: 'Finalizado',
        metodo_pago: metodoPago,
        pago_confirmado: metodoPago !== 'A Cuenta',
        vendedor: 'Terminal POS',
        origen: 'Mostrador', // 👈 CAMBIO CLAVE: Antes decía 'POS', ahora dice 'Mostrador' para que AdminOrders lo reconozca.
        detalle_pedido: cart.map(item => ({
          id: item.id,
          sku: item.sku,
          nombre: item.nombre,
          quantity: item.quantity,
          price: item.precio_venta
        }))
      }]);
// ...

      if (errPedido) throw errPedido;

      // 4. Descontar Stock
      for (const item of cart) {
        const pRef = products.find(p => p.id === item.id);
        await supabase.from('productos').update({ stock_actual: (pRef?.stock_actual || 0) - item.quantity }).eq('id', item.id);
      }

      // 5. WhatsApp (SOLO SI NO ES ANÓNIMO)
      if (!isAnonymous && clienteFinal.telefono) {
        const msg = `*AMOREE MARKET* 🥑\n\nGracias por tu compra, *${clienteFinal.nombre}*.\nTotal: ${formatCurrency(total)}\nPago: ${metodoPago}${metodoPago === 'A Cuenta' ? `\n\n*Saldo Actual:* ${formatCurrency(nuevoSaldo)}` : ''}`;
        window.open(`https://wa.me/52${clienteFinal.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
      }

      alert("🎉 Venta finalizada.");
      setCart([]);
      setShowPaymentModal(false);
      setSelectedClient(null);
      setIsAddingNewClient(false);
      setIsAnonymous(true);
      fetchData();
    } catch (e: any) { alert(e.message); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black text-white">
      {/* SECCIÓN IZQUIERDA: PRODUCTOS */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onBack} className="bg-white/5 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">← Volver</button>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl"><Camera size={24} /></button>
        </div>
        
        <input 
          type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full bg-[#0A0A0A] border border-white/10 rounded-3xl py-6 px-8 font-black uppercase outline-none focus:border-green-500 mb-8" 
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
            <button key={product.id} onClick={() => product.stock_actual > 0 && addToCart(product)} className={`p-6 rounded-[40px] border text-left transition-all ${product.stock_actual <= 0 ? 'opacity-20 border-red-900/20' : 'bg-[#0A0A0A] border-white/5 hover:border-green-500/40'}`}>
              <p className="text-[9px] text-gray-600 uppercase font-black mb-1">{product.categoria}</p>
              <p className="font-black text-white uppercase text-xs mb-4 leading-tight">{product.nombre}</p>
              <div className="flex justify-between items-center"><p className="text-xl font-black">{formatCurrency(product.precio_venta)}</p><p className="text-[8px] text-gray-600 font-bold">Stock: {product.stock_actual}</p></div>
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN DERECHA: CARRITO */}
      <div className="w-full lg:w-[450px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-10 sticky top-6 shadow-2xl">
          <h3 className="font-black uppercase text-xs mb-8 italic">Carrito</h3>
          <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-6">
                <div className="flex-1"><p className="text-xs font-black uppercase text-white">{item.nombre}</p><p className="text-[10px] text-gray-500">{formatCurrency(item.precio_venta)}</p></div>
                <div className="flex items-center gap-4 bg-black rounded-2xl p-2 border border-white/5">
                  <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14}/></button>
                  <span className="font-black text-xs min-w-[20px] text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-green-500"><Plus size={14}/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-end mb-10 px-2"><span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Total</span><span className="text-5xl font-black text-white">{formatCurrency(total)}</span></div>
          <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-8 bg-white text-black rounded-[30px] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-green-500 transition-all">Cobrar</button>
        </div>
      </div>

      {/* ✅ MODAL DE COBRO CON PRIVACIDAD */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-12 w-full max-w-xl shadow-2xl relative max-h-[95vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X /></button>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8">Finalizar <span className="text-green-500">Venta</span></h3>

            {/* INTERRUPTOR DE PRIVACIDAD */}
            <div className="flex bg-black p-2 rounded-[25px] border border-white/10 mb-8">
              <button 
                onClick={() => { setIsAnonymous(true); setSelectedClient(null); setMetodoPago('Efectivo'); }}
                className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${isAnonymous ? 'bg-white text-black' : 'text-gray-500'}`}
              >
                <ShieldOff size={14}/> Venta Anónima
              </button>
              <button 
                onClick={() => setIsAnonymous(false)}
                className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${!isAnonymous ? 'bg-green-600 text-white shadow-lg shadow-green-900/40' : 'text-gray-500'}`}
              >
                <UserCheck size={14}/> Cliente Fiel
              </button>
            </div>

            {/* SECCIÓN CLIENTE (SOLO SI NO ES ANÓNIMO) */}
            {!isAnonymous && (
              <div className="mb-10 animate-in slide-in-from-top duration-300">
                {!selectedClient && !isAddingNewClient ? (
                  <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                    <input type="text" placeholder="BUSCAR CLIENTE..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-3xl py-6 pl-16 pr-8 font-black uppercase text-xs outline-none focus:border-green-500" />
                    {clientSearch && (
                      <div className="absolute top-full left-0 right-0 bg-[#111] border border-white/10 rounded-[30px] mt-2 overflow-hidden z-[210] shadow-2xl">
                        {clientes.filter(c => c.nombre.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                          <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch('');}} className="w-full p-5 text-left hover:bg-green-500/10 border-b border-white/5 flex justify-between items-center transition-all">
                            <div><p className="text-xs font-black uppercase text-white">{c.nombre}</p><p className="text-[10px] text-gray-500 font-bold">{c.telefono}</p></div>
                            <p className="text-xs font-black text-orange-500">{formatCurrency(c.saldo)}</p>
                          </button>
                        ))}
                        <button onClick={() => setIsAddingNewClient(true)} className="w-full p-6 text-green-500 font-black text-xs uppercase flex items-center justify-center gap-3 bg-green-500/5 hover:bg-green-500/10"><UserPlus size={18}/> Nuevo Cliente</button>
                      </div>
                    )}
                  </div>
                ) : selectedClient ? (
                  <div className="bg-green-500/5 border border-green-500/20 p-8 rounded-[35px] flex justify-between items-center">
                    <div><p className="text-[10px] font-black uppercase text-green-500 mb-2 tracking-widest">Cliente Seleccionado</p><p className="text-2xl font-black uppercase italic">{selectedClient.nombre}</p></div>
                    <button onClick={() => setSelectedClient(null)} className="text-gray-500 hover:text-red-500"><X size={20}/></button>
                  </div>
                ) : (
                  <div className="space-y-4 p-8 bg-white/[0.02] rounded-[35px] border border-white/10">
                    <input type="text" placeholder="NOMBRE COMPLETO" value={newClientData.nombre} onChange={(e) => setNewClientData({...newClientData, nombre: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-5 font-black uppercase text-xs" />
                    <input type="tel" placeholder="TELÉFONO" value={newClientData.telefono} onChange={(e) => setNewClientData({...newClientData, telefono: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-5 font-black text-xs" />
                    <button onClick={() => setIsAddingNewClient(false)} className="text-[9px] text-gray-600 font-black uppercase">← Volver</button>
                  </div>
                )}
              </div>
            )}

            {/* MÉTODOS DE PAGO */}
            <div className="grid grid-cols-2 gap-4 mb-10">
              {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                <button 
                  key={m} 
                  disabled={isAnonymous && m === 'A Cuenta'} // ✅ BLOQUEO DE SEGURIDAD
                  onClick={() => setMetodoPago(m as any)} 
                  className={`p-6 rounded-[30px] border flex flex-col items-center gap-3 transition-all ${metodoPago === m ? 'bg-green-600 border-green-600 text-white shadow-xl shadow-green-900/30' : (isAnonymous && m === 'A Cuenta' ? 'opacity-10 cursor-not-allowed' : 'bg-black border-white/5 text-gray-500 hover:border-white/20')}`}
                >
                  {m === 'Efectivo' && <DollarSign size={20}/>}
                  {m === 'A Cuenta' && <BookOpen size={20}/>}
                  {m === 'Tarjeta' && <CreditCard size={20}/>}
                  {m === 'Transferencia' && <Smartphone size={20}/>}
                  <span className="font-black uppercase text-[10px] tracking-widest">{m}</span>
                </button>
              ))}
            </div>

            <button onClick={finalizarVenta} disabled={isSubmitting} className="w-full py-8 bg-white text-black rounded-[40px] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-green-500 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-4 active:scale-95">
              {isSubmitting ? 'PROCESANDO...' : <>FINALIZAR OPERACIÓN <Send size={18}/></>}
            </button>
          </div>
        </div>
      )}

      {showScanner && <Scanner onScanSuccess={(text) => {
          const p = products.find(p => (p.sku === text || p.SKU === text));
          if (p && p.stock_actual > 0) { addToCart(p); setShowScanner(false); }
          else { alert("No disponible"); setShowScanner(false); }
      }} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
