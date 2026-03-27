import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, X, DollarSign, CreditCard, 
  Send, UserCheck, ShieldOff, Scale, Zap, UserPlus, Receipt, Camera
} from 'lucide-react';
import { format } from 'date-fns';

const cleanText = (text: string) => 
  (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function POS({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [products, setProducts] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [withTicket, setWithTicket] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true); 
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'A Cuenta'>('Efectivo');
  
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ nombre: '', telefono: '' });

  const [pagoCon, setPagoCon] = useState<string>('');
  const totalVenta = useMemo(() => cart.reduce((sum, item) => sum + (item.precio_venta * (Number(item.quantity) || 0)), 0), [cart]);
  const cambio = parseFloat(pagoCon || '0') >= totalVenta ? parseFloat(pagoCon || '0') - totalVenta : 0;

  // ✅ CANDADO MAESTRO DE BOTÓN
  const isPaymentDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (metodoPago === 'Efectivo') {
      const monto = parseFloat(pagoCon || '0');
      return monto < totalVenta; // Bloqueado si paga menos del total
    }
    if (metodoPago === 'A Cuenta' && (isAnonymous || !selectedClient)) return true;
    return false;
  }, [isSubmitting, metodoPago, pagoCon, totalVenta, isAnonymous, selectedClient]);

  useEffect(() => { 
    fetchData();
    setTimeout(() => searchInputRef.current?.focus(), 600);
  }, []);

  const fetchData = async () => {
    const { data: p } = await supabase.from('productos').select('*').eq('activo', true);
    const { data: c } = await supabase.from('clientes').select('*').order('nombre');
    if (p) setProducts(p);
    if (c) setClientes(c);
    setLoading(false);
  };

  const filteredProducts = useMemo(() => {
    const term = cleanText(searchTerm);
    return products.filter(p => cleanText(p.nombre).includes(term) || cleanText(p.categoria || '').includes(term));
  }, [products, searchTerm]);

  const addToCart = (product: any) => {
    const inCart = cart.find(item => item.id === product.id);
    const qtyInCart = inCart ? inCart.quantity : 0;
    if (qtyInCart + 1 > product.stock_actual) return alert(`⚠️ Stock insuficiente: ${product.stock_actual} disponibles.`);

    setCart(prev => {
      if (inCart) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id: number, value: string) => {
    const numValue = parseFloat(value);
    const pRef = products.find(p => p.id === id);
    if (numValue > (pRef?.stock_actual || 0)) return alert(`⚠️ Máximo en stock: ${pRef?.stock_actual}`);
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: value === '' || isNaN(numValue) ? 0 : numValue } : item));
  };

  const crearNuevoCliente = async () => {
    if (!newClient.nombre || !newClient.telefono) return alert("Datos obligatorios");
    const { data, error } = await supabase.from('clientes').insert([{
      nombre: newClient.nombre.toUpperCase(),
      telefono: newClient.telefono,
      saldo_deudor: 0
    }]).select().single();
    if (data) {
      setClientes(p => [...p, data]); setSelectedClient(data); setClientSearch(data.nombre);
      setShowNewClientForm(false); setNewClient({ nombre: '', telefono: '' });
    }
  };

  const enviarTicketWA = (cliente: any, saldoAnt: number, saldoNue: number) => {
    const fecha = format(new Date(), 'dd/MM/yyyy HH:mm');
    let msg = `*AMOREE - TICKET DIGITAL* 🌿\n--------------------------------\n📅 *Fecha:* ${fecha}\n👤 *Cliente:* ${cliente.nombre}\n💳 *Método:* ${metodoPago}\n--------------------------------\n`;
    cart.forEach(i => { msg += `• ${i.quantity} ${i.unidad || 'kg'} x ${i.nombre}\n  Sub: ${formatCurrency(i.precio_venta * i.quantity)}\n`; });
    msg += `--------------------------------\n💰 *TOTAL: ${formatCurrency(totalVenta)}*\n`;
    if (metodoPago === 'Efectivo') msg += `💵 Pago: ${formatCurrency(parseFloat(pagoCon || '0'))}\n🪙 Cambio: ${formatCurrency(cambio)}\n`;
    if (metodoPago === 'A Cuenta') msg += `\n📉 *SALDO:*\nAnt: ${formatCurrency(saldoAnt)}\n*NUEVO: ${formatCurrency(saldoNue)}*\n`;
    msg += `--------------------------------\n¡Gracias por tu compra! 🥑`;
    window.open(`https://wa.me/52${cliente.telefono}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const finalizarVenta = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const clienteFinal = isAnonymous ? { nombre: 'PÚBLICO GENERAL', telefono: '', id: null, saldo_deudor: 0 } : selectedClient;
      const saldoAnterior = clienteFinal.saldo_deudor || 0;
      const nuevoSaldo = metodoPago === 'A Cuenta' ? saldoAnterior + totalVenta : saldoAnterior;

      // ✅ INSERCIÓN BLINDADA (Según pedidos_rows.csv)
      const payload = {
        usuario_email: user?.email || 'mostrador@amoree.com',
        nombre_cliente: clienteFinal.nombre,
        telefono_cliente: clienteFinal.telefono,
        cliente_id: clienteFinal.id,
        total: totalVenta,
        estado: 'Finalizado',
        metodo_pago: metodoPago,
        origen: 'Mostrador',
        vendedor: 'Hugo - Terminal',
        detalle_pedido: cart.map(i => ({ id: i.id, sku: i.sku, nombre: i.nombre, quantity: i.quantity, price: i.precio_venta, unidad: i.unidad }))
      };

      const { data: pedido, error: errP } = await supabase.from('pedidos').insert([payload]).select();

      if (errP) throw new Error(`DB Error: ${errP.message} (Código: ${errP.code})`);

      // 2. Descontar Stock
      for (const i of cart) {
        const pRef = products.find(p => p.id === i.id);
        await supabase.from('productos').update({ stock_actual: (pRef?.stock_actual || 0) - i.quantity }).eq('id', i.id);
      }
      
      // 3. Saldo Deudor
      if (metodoPago === 'A Cuenta' && clienteFinal.id) {
        await supabase.from('clientes').update({ saldo_deudor: nuevoSaldo }).eq('id', clienteFinal.id);
      }

      if (withTicket && !isAnonymous) enviarTicketWA(clienteFinal, saldoAnterior, nuevoSaldo);
      else alert(`✅ Venta Exitosa.`);

      setCart([]); setPagoCon(''); setShowPaymentModal(false); fetchData();
      searchInputRef.current?.focus();
    } catch (e: any) { 
      alert("❌ ERROR CRÍTICO:\n" + e.message); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Zap className="text-green-500 animate-pulse" size={40}/></div>;

  return (
    <div className="h-screen bg-black text-white font-sans flex flex-col overflow-hidden">
      {/* HEADER COMPACTO */}
      <div className="p-3 border-b border-white/5 flex justify-between items-center bg-[#050505] shrink-0">
        <button onClick={onBack} className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5">← Salir</button>
        <div className="bg-green-600/10 border border-green-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <Zap size={12} className="text-green-500"/>
          <span className="text-[8px] font-black uppercase text-green-400">Tablet Optimized v4</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* IZQUIERDA: PRODUCTOS (4-5 COLUMNAS) */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden border-r border-white/5">
          <div className="relative shrink-0">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input ref={searchInputRef} type="text" placeholder="BUSCAR O ESCANEAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 pl-14 pr-6 font-black uppercase text-xs outline-none focus:border-green-500" />
          </div>

          <div className="grid grid-cols-4 xl:grid-cols-5 gap-2 overflow-y-auto no-scrollbar flex-1 pb-10">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className={`p-3 rounded-[25px] border text-left transition-all h-32 flex flex-col justify-between ${p.stock_actual <= 0 ? 'opacity-20 grayscale' : 'bg-[#0A0A0A] border-white/5 hover:border-green-500 shadow-lg'}`}>
                <div>
                   <p className="text-[6px] text-gray-600 uppercase font-black mb-1 truncate">{p.categoria}</p>
                   <p className="font-black text-white uppercase text-[9px] leading-tight line-clamp-2">{p.nombre}</p>
                </div>
                <div className="flex justify-between items-end">
                   <p className="text-sm font-black text-green-500">{formatCurrency(p.precio_venta)}</p>
                   <p className={`text-[7px] font-black uppercase ${p.stock_actual < 2 ? 'text-red-500' : 'text-gray-600'}`}>{p.stock_actual}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* DERECHA: CARRITO */}
        <div className="w-[340px] flex flex-col bg-[#050505] p-5 shadow-2xl shrink-0">
          <h3 className="font-black uppercase text-[10px] italic flex items-center gap-2 text-green-500 mb-6"><ShoppingCart size={14}/> Carrito Amoree</h3>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-6">
            {cart.map(item => (
              <div key={item.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[9px] font-black uppercase text-white truncate flex-1">{item.nombre}</p>
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-700 hover:text-red-500"><X size={14}/></button>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center bg-black rounded-lg border border-white/10 px-2 py-1">
                      <input type="number" step="0.001" value={item.quantity} onChange={(e) => updateQuantity(item.id, e.target.value)} className="bg-transparent w-14 text-xs font-black text-green-500 outline-none" />
                      <span className="text-[7px] font-black text-gray-600 uppercase ml-1">{item.unidad || 'kg'}</span>
                   </div>
                   <p className="text-xs font-black text-white">{formatCurrency(item.precio_venta * (item.quantity || 0))}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-4">
            <div className="flex justify-between items-end mb-4">
              <span className="text-[9px] text-gray-500 uppercase font-black">Total Venta</span>
              <span className="text-3xl font-black text-white tracking-tighter">{formatCurrency(totalVenta)}</span>
            </div>
            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-5 bg-green-600 text-black rounded-2xl font-black uppercase text-[10px] hover:bg-green-500 shadow-xl">Siguiente</button>
          </div>
        </div>
      </div>

      {/* MODAL COBRO TITANIUM */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/98 backdrop-blur-2xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-8 w-full max-w-4xl shadow-2xl relative flex gap-10">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-gray-500"><X size={24}/></button>
            <div className="flex-1">
              <h3 className="text-3xl font-black uppercase italic text-blue-500 mb-8">Cobro Amoree</h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => {setWithTicket(false); setIsAnonymous(true); setSelectedClient(null);}} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 ${!withTicket ? 'bg-white text-black' : 'bg-black border-white/5 text-gray-600'}`}>
                  <ShieldOff size={20}/><span className="text-[9px] font-black uppercase">Venta Rápida</span>
                </button>
                <button onClick={() => {setWithTicket(true); setIsAnonymous(false);}} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 ${withTicket ? 'bg-green-600 border-green-600 text-white' : 'bg-black border-white/5 text-gray-600'}`}>
                  <Receipt size={20}/><span className="text-[9px] font-black uppercase">Ticket Digital</span>
                </button>
              </div>
              <div className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Cliente</span>
                  <button onClick={() => setShowNewClientForm(true)} className="text-[8px] font-black text-blue-500 flex items-center gap-1"><UserPlus size={10}/> Nuevo</button>
                </div>
                <input type="text" placeholder="BUSCAR..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 font-black uppercase text-[10px] outline-none" />
                <div className="max-h-24 overflow-y-auto no-scrollbar border-l border-white/5 mt-2">
                  {clientes.filter(c => cleanText(c.nombre).includes(cleanText(clientSearch))).map(c => (
                    <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch(c.nombre);}} className={`w-full p-2.5 text-left text-[9px] uppercase font-black border-b border-white/5 ${selectedClient?.id === c.id ? 'text-green-500' : 'text-gray-600'}`}>{c.nombre} • {c.telefono}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                  <button key={m} disabled={isAnonymous && m === 'A Cuenta'} onClick={() => setMetodoPago(m as any)} className={`py-4 rounded-xl border flex flex-col items-center justify-center ${metodoPago === m ? 'bg-blue-600 text-white shadow-lg' : 'bg-black border-white/5 text-gray-700'}`}>
                    <span className="font-black uppercase text-[9px]">{m}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="w-[340px] bg-white/[0.02] border border-white/5 rounded-[40px] p-8 flex flex-col justify-between">
                <div>
                  <div className="text-center mb-8"><p className="text-[9px] font-black text-gray-500 uppercase">A Cobrar</p><p className="text-4xl font-black italic text-white">{formatCurrency(totalVenta)}</p></div>
                  {metodoPago === 'Efectivo' && (
                    <div className="space-y-4">
                      <div className="bg-black border border-white/10 rounded-2xl p-4">
                        <label className="text-[7px] font-black text-gray-600 uppercase block mb-1">Recibido:</label>
                        <input type="number" value={pagoCon} onChange={(e) => setPagoCon(e.target.value)} className="bg-transparent w-full text-3xl font-black text-white outline-none" placeholder="0.00" />
                      </div>
                      <div className="text-center py-4 bg-green-500/5 rounded-2xl border border-green-500/10">
                        <p className="text-[8px] font-black text-green-500 uppercase mb-1">Cambio:</p>
                        <p className="text-3xl font-black text-white">{formatCurrency(cambio)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[50, 100, 200, 500].map(b => (
                          <button key={b} onClick={() => setPagoCon(b.toString())} className="bg-white/5 py-3 rounded-xl text-[10px] font-black hover:bg-white hover:text-black transition-all">${b}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* ✅ EL BOTÓN YA NO DEJA PASAR SI FALTA DINERO EN EFECTIVO */}
                <button onClick={finalizarVenta} disabled={isPaymentDisabled} className={`w-full py-6 rounded-[25px] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all ${isPaymentDisabled ? 'bg-white/10 text-gray-500' : 'bg-white text-black'}`}>
                  {isSubmitting ? 'GUARDANDO...' : 'Confirmar Venta'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {showNewClientForm && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-[40px] w-full max-w-sm">
            <h3 className="text-xl font-black uppercase italic mb-6">Nuevo Cliente Amoree</h3>
            <div className="space-y-4">
              <input type="text" placeholder="NOMBRE" value={newClient.nombre} onChange={(e) => setNewClient({...newClient, nombre: e.target.value})} className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-black uppercase text-green-500 outline-none" />
              <input type="number" placeholder="CELULAR" value={newClient.telefono} onChange={(e) => setNewClient({...newClient, telefono: e.target.value})} className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-black outline-none" />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowNewClientForm(false)} className="flex-1 bg-white/5 py-4 rounded-xl text-[10px] font-black uppercase">Cerrar</button>
                <button onClick={crearNuevoCliente} className="flex-1 bg-blue-600 py-4 rounded-xl text-[10px] font-black uppercase text-white">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
