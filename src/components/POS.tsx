import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, Plus, Minus, Camera, X, 
  User, Phone, DollarSign, CreditCard, Smartphone, BookOpen, Send, UserPlus 
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
  
  // ✅ ESTADOS DE CLIENTE Y PAGO (RESTAURADOS AL 100%)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

  // ✅ TICKET DIGITAL WHATSAPP
  const enviarTicketWhatsApp = (nombre: string, telefono: string, metodo: string, saldoPendiente: number) => {
    const itemsText = cart.map(item => `- ${item.nombre} x${item.quantity}: ${formatCurrency(item.precio_venta * item.quantity)}`).join('%0A');
    let mensaje = `*AMOREE MARKET* 🥑%0A%0A*CLIENTE:* ${nombre.toUpperCase()}%0A*DETALLE:*%0A${itemsText}%0A%0A*TOTAL:* ${formatCurrency(total)}%0A*PAGO:* ${metodo}`;
    
    if (metodo === 'A Cuenta') {
      mensaje += `%0A%0A*SALDO ACTUALIZADO:* ${formatCurrency(saldoPendiente)}%0A_Favor de liquidar pronto._`;
    }
    
    mensaje += `%0A%0A¡Gracias por tu compra! 🚀`;
    const telLimpio = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/52${telLimpio}?text=${mensaje}`, '_blank');
  };

  // ✅ FUNCIÓN DE COBRO TITANIUM (VINCULA AUDITORÍA)
  const finalizarVenta = async () => {
    if (cart.length === 0) return;
    
    let clienteFinal = selectedClient;

    setIsSubmitting(true);
    try {
      // 1. Manejo de Cliente Nuevo
      if (isAddingNewClient) {
        const { data: nCl, error: nClErr } = await supabase
          .from('clientes')
          .insert([{ nombre: newClientData.nombre.toUpperCase(), telefono: newClientData.telefono, saldo: 0 }])
          .select().single();
        if (nClErr) throw nClErr;
        clienteFinal = nCl;
      }

      if (!clienteFinal) throw new Error("Debes seleccionar un cliente");

      // 2. Lógica "A Cuenta" (Saldo en Tabla Clientes)
      let saldoActualizado = Number(clienteFinal.saldo || 0);
      if (metodoPago === 'A Cuenta') {
        saldoActualizado += total;
        await supabase.from('clientes').update({ saldo: saldoActualizado }).eq('id', clienteFinal.id);
      }

      // 3. Registrar Pedido (ESTO REPARA LA AUDITORÍA)
      const { error: errPedido } = await supabase
        .from('pedidos')
        .insert([{
          usuario_email: user?.email,
          nombre_cliente: clienteFinal.nombre,
          telefono_cliente: clienteFinal.telefono,
          cliente_id: clienteFinal.id,
          total: total,
          estado: 'Finalizado',
          metodo_pago: metodoPago,
          pago_confirmado: metodoPago !== 'A Cuenta',
          vendedor: 'Terminal POS',
          origen: 'POS', // ✅ CRUCIAL: Esto hace que aparezca en la Auditoría
          detalle_pedido: cart.map(item => ({
            id: item.id,
            sku: item.sku,
            nombre: item.nombre,
            quantity: item.quantity,
            price: item.precio_venta
          }))
        }]);

      if (errPedido) throw errPedido;

      // 4. Descontar Stock
      for (const item of cart) {
        const pRef = products.find(p => p.id === item.id);
        await supabase.from('productos').update({ stock_actual: (pRef?.stock_actual || 0) - item.quantity }).eq('id', item.id);
      }

      // 5. WhatsApp
      enviarTicketWhatsApp(clienteFinal.nombre, clienteFinal.telefono, metodoPago, saldoActualizado);

      alert("🎉 Venta registrada con éxito.");
      setCart([]);
      setShowPaymentModal(false);
      setSelectedClient(null);
      setIsAddingNewClient(false);
      setNewClientData({ nombre: '', telefono: '' });
      fetchData();
    } catch (e: any) {
      alert(`⚠️ ERROR: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.telefono.includes(clientSearch)
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black animate-in fade-in duration-500">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-8">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">← Regresar</button>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Terminal</span></h2>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg"><Camera size={24} /></button>
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
              <div className="flex justify-between items-center"><p className="text-xl font-black">{formatCurrency(product.precio_venta)}</p><p className="text-[8px] text-gray-600 font-bold uppercase">Stock: {product.stock_actual}</p></div>
            </button>
          ))}
        </div>
      </div>

      {/* CARRITO */}
      <div className="w-full lg:w-[450px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-10 sticky top-6 shadow-2xl">
          <h3 className="font-black uppercase text-xs mb-8 italic">Ticket en Curso</h3>
          <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-6">
                <div className="flex-1"><p className="text-xs font-black uppercase text-white leading-tight">{item.nombre}</p><p className="text-[10px] text-gray-500">{formatCurrency(item.precio_venta)}</p></div>
                <div className="flex items-center gap-4 bg-black rounded-2xl p-2 border border-white/5">
                  <button onClick={() => updateQuantity(item.id, -1)}><Minus size={14}/></button>
                  <span className="font-black text-xs min-w-[20px] text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-green-500"><Plus size={14}/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-end mb-10"><span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Total</span><span className="text-5xl font-black text-white">{formatCurrency(total)}</span></div>
          <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-8 bg-white text-black rounded-[30px] font-black uppercase tracking-[0.2em] text-[11px] hover:bg-green-500 transition-all">Cobrar</button>
        </div>
      </div>

      {/* ✅ MODAL DE COBRO (RESTAURADO) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-12 w-full max-w-xl shadow-2xl relative max-h-[95vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X /></button>
            <h3 className="text-3xl font-black uppercase italic mb-10 tracking-tighter">Cierre <span className="text-green-500">Amoree</span></h3>

            {/* SECCIÓN CLIENTE CON DROPDOWN */}
            <div className="mb-10 space-y-4">
              {!selectedClient && !isAddingNewClient ? (
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
                  <input type="text" placeholder="BUSCAR CLIENTE (NOMBRE/TEL)..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-3xl py-6 pl-16 pr-8 font-black uppercase text-xs outline-none focus:border-green-500" />
                  {clientSearch && (
                    <div className="absolute top-full left-0 right-0 bg-[#111] border border-white/10 rounded-[30px] mt-2 overflow-hidden z-[210] shadow-2xl">
                      {filteredClientes.map(c => (
                        <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch('');}} className="w-full p-5 text-left hover:bg-green-500/10 border-b border-white/5 flex justify-between items-center">
                          <div><p className="text-xs font-black uppercase text-white">{c.nombre}</p><p className="text-[10px] text-gray-500 font-bold">{c.telefono}</p></div>
                          <div className="text-right">
                             <p className="text-[8px] font-black text-gray-600 uppercase mb-1">Saldo</p>
                             <p className={`text-xs font-black ${Number(c.saldo) > 0 ? 'text-orange-500' : 'text-green-500'}`}>{formatCurrency(Number(c.saldo || 0))}</p>
                          </div>
                        </button>
                      ))}
                      <button onClick={() => setIsAddingNewClient(true)} className="w-full p-6 text-green-500 font-black text-xs uppercase flex items-center justify-center gap-3 bg-green-500/5 hover:bg-green-500/10 transition-all"><UserPlus size={18}/> Nuevo Cliente</button>
                    </div>
                  )}
                </div>
              ) : selectedClient ? (
                <div className="bg-green-500/5 border border-green-500/20 p-8 rounded-[35px] flex justify-between items-center">
                  <div><p className="text-[10px] font-black uppercase text-green-500 mb-2 tracking-widest">Cliente Seleccionado</p><p className="text-2xl font-black uppercase italic">{selectedClient.nombre}</p></div>
                  <button onClick={() => setSelectedClient(null)} className="bg-white/5 p-3 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all"><X size={20}/></button>
                </div>
              ) : (
                <div className="space-y-4 p-8 bg-white/[0.02] rounded-[35px] border border-white/10">
                  <input type="text" placeholder="NOMBRE COMPLETO" value={newClientData.nombre} onChange={(e) => setNewClientData({...newClientData, nombre: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-5 font-black uppercase text-xs" />
                  <input type="tel" placeholder="TELÉFONO" value={newClientData.telefono} onChange={(e) => setNewClientData({...newClientData, telefono: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-5 font-black text-xs" />
                  <button onClick={() => setIsAddingNewClient(false)} className="text-[9px] text-gray-600 font-black uppercase">Volver</button>
                </div>
              )}
            </div>

            {/* MÉTODOS DE PAGO */}
            <div className="grid grid-cols-2 gap-4 mb-12">
              {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                <button key={m} onClick={() => setMetodoPago(m as any)} className={`p-6 rounded-[30px] border flex flex-col items-center gap-3 transition-all ${metodoPago === m ? 'bg-green-600 border-green-600 text-white shadow-xl shadow-green-900/30' : 'bg-black border-white/5 text-gray-500 hover:border-white/20'}`}>
                  {m === 'Efectivo' && <DollarSign size={20}/>}
                  {m === 'A Cuenta' && <BookOpen size={20}/>}
                  {m === 'Tarjeta' && <CreditCard size={20}/>}
                  {m === 'Transferencia' && <Smartphone size={20}/>}
                  <span className="font-black uppercase text-[10px] tracking-widest">{m}</span>
                </button>
              ))}
            </div>

            <button onClick={finalizarVenta} disabled={isSubmitting} className="w-full py-8 bg-white text-black rounded-[35px] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-green-500 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-4">
              {isSubmitting ? 'PROCESANDO...' : <>FINALIZAR Y ENVIAR TICKET <Send size={18}/></>}
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
