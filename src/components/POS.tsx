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
  
  // ✅ ESTADOS DE CLIENTE Y PAGO (RESTAURADOS)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newClientData, setNewClientData] = useState({ nombre: '', telefono: '' });
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'A Cuenta'>('Efectivo');

  useEffect(() => { 
    fetchData(); 
  }, []);

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

  // ✅ LÓGICA DE TICKET WHATSAPP CON SALDO
  const enviarTicketWhatsApp = (nombre: string, telefono: string, metodo: string, nuevoSaldo: number = 0) => {
    const itemsText = cart.map(item => `- ${item.nombre} x${item.quantity}: ${formatCurrency(item.precio_venta * item.quantity)}`).join('%0A');
    let mensaje = `*¡HOLA ${nombre.toUpperCase()}!*%0A%0AGracias por tu compra en *AMOREE MARKET* 🥑%0A%0A*DETALLE:*%0A${itemsText}%0A%0A*TOTAL:* ${formatCurrency(total)}%0A*PAGO:* ${metodo}`;
    
    if (metodo === 'A Cuenta') {
      mensaje += `%0A%0A*SALDO PENDIENTE:* ${formatCurrency(nuevoSaldo)}%0A_Por favor, recuerda liquidar pronto._`;
    }
    
    mensaje += `%0A%0A¡Te esperamos pronto! 🚀`;
    const telLimpio = telefono.replace(/\D/g, '');
    window.open(`https://wa.me/52${telLimpio}?text=${mensaje}`, '_blank');
  };

  // ✅ FUNCIÓN DE COBRO MAESTRA
  const finalizarVenta = async () => {
    if (cart.length === 0) return;
    
    let clienteFinal = selectedClient;

    // 1. Si es nuevo cliente, crearlo primero
    if (isAddingNewClient) {
      if (!newClientData.nombre || !newClientData.telefono) return alert("Datos de cliente incompletos");
      const { data: nCl, error: nClErr } = await supabase
        .from('clientes')
        .insert([{ nombre: newClientData.nombre.toUpperCase(), telefono: newClientData.telefono, saldo: 0 }])
        .select().single();
      if (nClErr) throw nClErr;
      clienteFinal = nCl;
    }

    if (!clienteFinal) return alert("Socio, selecciona o crea un cliente para el ticket.");

    setIsSubmitting(true);
    try {
      // 2. Si es 'A Cuenta', actualizar saldo del cliente
      let saldoActualizado = clienteFinal.saldo || 0;
      if (metodoPago === 'A Cuenta') {
        saldoActualizado += total;
        await supabase.from('clientes').update({ saldo: saldoActualizado }).eq('id', clienteFinal.id);
      }

      // 3. Registrar Pedido (Blindado)
      const { error: errPedido } = await supabase
        .from('pedidos')
        .insert([{
          usuario_email: user?.email,
          nombre_cliente: clienteFinal.nombre,
          telefono_cliente: clienteFinal.telefono,
          total: total,
          estado: 'Finalizado',
          metodo_pago: metodoPago,
          pago_confirmado: metodoPago !== 'A Cuenta',
          vendedor: 'Terminal POS',
          origen: 'POS', // 👈 ESTO ASEGURA QUE APAREZCA EN LA SECCIÓN CORRECTA
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

      alert("🎉 Venta procesada y ticket generado.");
      setCart([]);
      setShowPaymentModal(false);
      setSelectedClient(null);
      setNewClientData({ nombre: '', telefono: '' });
      setIsAddingNewClient(false);
      fetchData(); // Recargar todo
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredClientes = clientes.filter(c => c.nombre.toLowerCase().includes(clientSearch.toLowerCase()) || c.telefono.includes(clientSearch));

  if (loading) return <div className="p-10 text-green-500 font-black animate-pulse">Sincronizando Sistema Titanium...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black">
      <div className="flex-1">
        <div className="flex justify-between mb-8">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl">← Regresar</button>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl"><Camera size={24} /></button>
        </div>
        <input type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-5 px-8 font-black uppercase outline-none focus:border-green-500 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <button key={product.id} onClick={() => product.stock_actual > 0 && addToCart(product)} className={`p-6 rounded-[35px] border text-left ${product.stock_actual <= 0 ? 'opacity-30 border-red-900/40' : 'bg-[#0A0A0A] border-white/5 hover:border-green-500/30'}`}>
              <p className="text-[9px] text-gray-600 uppercase font-black mb-1">{product.categoria}</p>
              <p className="font-black text-white uppercase text-xs mb-4 leading-tight">{product.nombre}</p>
              <div className="flex justify-between items-center"><p className="text-lg font-black">{formatCurrency(product.precio_venta)}</p><p className="text-[8px] text-gray-600">Stock: {product.stock_actual}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-[450px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[45px] p-10 sticky top-6">
          <h3 className="font-black uppercase text-xs mb-8 italic">Carrito Actual</h3>
          <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto no-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-6">
                <div className="flex-1"><p className="text-xs font-black uppercase text-white">{item.nombre}</p><p className="text-[10px] text-gray-500">{formatCurrency(item.precio_venta)}</p></div>
                <div className="flex items-center gap-4"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={14}/></button><span className="font-black text-xs">{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)}><Plus size={14}/></button></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-end mb-10"><span className="text-[10px] text-gray-500 uppercase font-black">Total</span><span className="text-4xl font-black text-white">{formatCurrency(total)}</span></div>
          <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-7 rounded-[30px] font-black bg-white text-black hover:bg-green-500 uppercase tracking-widest text-xs">Cobrar Ticket</button>
        </div>
      </div>

      {/* ✅ MODAL DE COBRO CON SELECTOR DE CLIENTE (RESTORED) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in zoom-in-95">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-12 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X /></button>
            <h3 className="text-3xl font-black uppercase italic mb-10">Cierre de <span className="text-green-500">Venta</span></h3>

            {/* SECCIÓN CLIENTE */}
            <div className="mb-10 space-y-4">
              {!selectedClient && !isAddingNewClient ? (
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input type="text" placeholder="BUSCAR CLIENTE..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-3xl py-5 pl-14 pr-6 font-black uppercase text-xs" />
                  {clientSearch && (
                    <div className="absolute top-full left-0 right-0 bg-[#0A0A0A] border border-white/10 rounded-3xl mt-2 overflow-hidden z-50">
                      {filteredClientes.map(c => (
                        <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch('');}} className="w-full p-4 text-left hover:bg-white/5 border-b border-white/5 flex justify-between items-center">
                          <div><p className="text-xs font-black uppercase">{c.nombre}</p><p className="text-[10px] text-gray-500">{c.telefono}</p></div>
                          <p className="text-xs font-black text-orange-500">Debe: {formatCurrency(c.saldo)}</p>
                        </button>
                      ))}
                      <button onClick={() => setIsAddingNewClient(true)} className="w-full p-4 text-green-500 font-black text-xs uppercase flex items-center gap-2 bg-green-500/5"><UserPlus size={16}/> Crear Cliente Nuevo</button>
                    </div>
                  )}
                </div>
              ) : selectedClient ? (
                <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl flex justify-between items-center">
                  <div><p className="text-[10px] font-black uppercase text-green-500 mb-1">Cliente Seleccionado</p><p className="text-lg font-black uppercase">{selectedClient.nombre}</p><p className="text-xs font-bold text-gray-500">{selectedClient.telefono}</p></div>
                  <button onClick={() => setSelectedClient(null)} className="text-gray-500 hover:text-red-500"><X /></button>
                </div>
              ) : (
                <div className="space-y-3 p-6 bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-2">Nuevo Cliente</p>
                  <input type="text" placeholder="NOMBRE COMPLETO" value={newClientData.nombre} onChange={(e) => setNewClientData({...newClientData, nombre: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-4 font-black uppercase text-xs" />
                  <input type="tel" placeholder="TELÉFONO" value={newClientData.telefono} onChange={(e) => setNewClientData({...newClientData, telefono: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl p-4 font-black text-xs" />
                  <button onClick={() => setIsAddingNewClient(false)} className="text-[10px] text-gray-500 font-black uppercase">Volver a buscar</button>
                </div>
              )}
            </div>

            {/* MÉTODOS DE PAGO */}
            <div className="grid grid-cols-2 gap-3 mb-10">
              {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                <button key={m} onClick={() => setMetodoPago(m as any)} className={`p-5 rounded-3xl border font-black uppercase text-[9px] flex items-center gap-3 ${metodoPago === m ? 'bg-green-600 border-green-600 text-white' : 'bg-black border-white/5 text-gray-500'}`}>
                  {m === 'Efectivo' && <DollarSign size={14}/>}
                  {m === 'A Cuenta' && <BookOpen size={14}/>}
                  {m}
                </button>
              ))}
            </div>

            <button onClick={finalizarVenta} disabled={isSubmitting} className="w-full py-7 bg-white text-black rounded-[30px] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-green-500 hover:text-white transition-all">
              {isSubmitting ? 'REGISTRANDO...' : 'FINALIZAR Y ENVIAR TICKET'}
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
