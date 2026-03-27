import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, X, DollarSign, Send, UserCheck, 
  ShieldOff, Scale, Zap, UserPlus, Receipt, Camera, Banknote
} from 'lucide-react';
import { format } from 'date-fns';

const cleanText = (text: string) => (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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

  const isPaymentDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (metodoPago === 'Efectivo') return parseFloat(pagoCon || '0') < totalVenta;
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
    return products.filter(p => cleanText(p.nombre).includes(term));
  }, [products, searchTerm]);

  const addToCart = (product: any) => {
    const inCart = cart.find(item => item.id === product.id);
    if ((inCart ? inCart.quantity : 0) + 1 > product.stock_actual) return alert(`⚠️ Stock insuficiente.`);
    setCart(prev => inCart ? prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...prev, { ...product, quantity: 1 }]);
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
    const { data, error } = await supabase.from('clientes').insert([{ nombre: newClient.nombre.toUpperCase(), telefono: newClient.telefono, saldo_deudor: 0 }]).select().single();
    if (data) { setClientes(p => [...p, data]); setSelectedClient(data); setClientSearch(data.nombre); setShowNewClientForm(false); }
  };

  const enviarTicketWA = (cliente: any, saldoNue: number) => {
    let msg = `*AMOREE - TICKET* 🌿\n👤 *C: ${cliente.nombre}* \n💰 *T: ${formatCurrency(totalVenta)}*\n`;
    if (metodoPago === 'Efectivo') msg += `💵 Pago: ${formatCurrency(parseFloat(pagoCon || '0'))}\n🪙 Cambio: ${formatCurrency(cambio)}\n`;
    if (metodoPago === 'A Cuenta') msg += `📉 *Saldo:* ${formatCurrency(saldoNue)}\n`;
    window.open(`https://wa.me/52${cliente.telefono}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const finalizarVenta = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const clienteFinal = isAnonymous ? { nombre: 'PÚBLICO GENERAL', telefono: '', id: null, saldo_deudor: 0 } : selectedClient;
      const nuevoSaldo = metodoPago === 'A Cuenta' ? (clienteFinal.saldo_deudor || 0) + totalVenta : (clienteFinal.saldo_deudor || 0);

      // PAYLOAD CON AUDITORÍA BLINDADA
      const payload = {
        usuario_email: user?.email || null,
        nombre_cliente: clienteFinal.nombre,
        telefono_cliente: clienteFinal.telefono,
        cliente_id: clienteFinal.id,
        total: totalVenta,
        estado: 'Finalizado',
        metodo_pago: metodoPago,
        origen: 'Mostrador',
        vendedor: 'Hugo - Terminal Tablet',
        pago_confirmado: true,
        detalle_pedido: cart.map(i => ({ id: i.id, sku: i.sku, nombre: i.nombre, quantity: i.quantity, price: i.precio_venta, unidad: i.unidad }))
      };

      const { data, error: errP } = await supabase.from('pedidos').insert([payload]).select();

      if (errP) throw new Error(`[ERROR DB] ${errP.message}`);

      // Actualizaciones secundarias
      for (const i of cart) {
        const pRef = products.find(p => p.id === i.id);
        await supabase.from('productos').update({ stock_actual: (pRef?.stock_actual || 0) - i.quantity }).eq('id', i.id);
      }
      if (metodoPago === 'A Cuenta' && clienteFinal.id) {
        await supabase.from('clientes').update({ saldo_deudor: nuevoSaldo }).eq('id', clienteFinal.id);
      }

      if (withTicket && !isAnonymous) enviarTicketWA(clienteFinal, nuevoSaldo);
      alert(`✅ VENTA #${data[0].id} REGISTRADA.`);

      setCart([]); setPagoCon(''); setShowPaymentModal(false); fetchData();
      searchInputRef.current?.focus();
    } catch (e: any) { alert("🛑 ERROR:\n" + e.message); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Zap className="text-green-500 animate-pulse" size={40}/></div>;

  return (
    <div className="h-screen bg-black text-white font-sans flex flex-col overflow-hidden animate-in fade-in">
      {/* HEADER COMPACTO */}
      <div className="p-3 border-b border-white/5 flex justify-between items-center bg-[#050505] shrink-0">
        <button onClick={onBack} className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-white/5">← Salir</button>
        <div className="flex gap-2">
           <div className="bg-green-600/10 border border-green-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <Zap size={12} className="text-green-500"/><span className="text-[8px] font-black uppercase text-green-400">POS Titanium v6</span>
           </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* IZQUIERDA: PRODUCTOS (Grid Compacto 4-5 Col) */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden border-r border-white/5">
          <div className="relative shrink-0">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input ref={searchInputRef} type="text" placeholder="BUSCAR ARTÍCULO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-2xl py-4 pl-14 pr-6 font-black uppercase text-xs outline-none focus:border-green-500" />
          </div>

          <div className="grid grid-cols-4 xl:grid-cols-5 gap-2 overflow-y-auto no-scrollbar flex-1 pb-10">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className={`p-3 rounded-[25px] border text-left transition-all h-32 flex flex-col justify-between ${p.stock_actual <= 0 ? 'opacity-20 grayscale' : 'bg-[#0A0A0A] border-white/5 hover:border-green-500 shadow-lg'}`}>
                <div><p className="text-[6px] text-gray-600 uppercase font-black mb-1 truncate">{p.categoria}</p><p className="font-black text-white uppercase text-[9px] leading-tight line-clamp-2">{p.nombre}</p></div>
                <div className="flex justify-between items-end"><p className="text-sm font-black text-green-500">{formatCurrency(p.precio_venta)}</p><p className={`text-[7px] font-black uppercase ${p.stock_actual < 2 ? 'text-red-500' : 'text-gray-600'}`}>{p.stock_actual}</p></div>
              </button>
            ))}
          </div>
        </div>

        {/* DERECHA: CARRITO COMPACTO */}
        <div className="w-[340px] flex flex-col bg-[#050505] p-5 shadow-2xl shrink-0 border-l border-white/5">
          <h3 className="font-black uppercase text-[10px] italic flex items-center gap-2 text-green-500 mb-6"><ShoppingCart size={14}/> Carrito Amoree</h3>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-6">
            {cart.map(item => (
              <div key={item.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-all">
                <div className="flex justify-between items-start mb-2"><p className="text-[9px] font-black uppercase text-white truncate flex-1">{item.nombre}</p><button onClick={() => setCart(c => c.filter(i => i.id !== item.id))} className="text-gray-700 hover:text-red-500"><X size={14}/></button></div>
                <div className="flex items-center justify-between"><div className="flex items-center bg-black rounded-lg border border-white/10 px-2 py-1"><input type="number" step="0.001" value={item.quantity} onChange={(e) => updateQuantity(item.id, e.target.value)} className="bg-transparent w-14 text-xs font-black text-green-500 outline-none" /><span className="text-[7px] font-black text-gray-600 uppercase ml-1">{item.unidad || 'kg'}</span></div><p className="text-xs font-black text-white">{formatCurrency(item.precio_venta * (item.quantity || 0))}</p></div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-4">
            <div className="flex justify-between items-end mb-4"><span className="text-[9px] text-gray-500 uppercase font-black">Total Venta</span><span className="text-3xl font-black text-white tracking-tighter">{formatCurrency(totalVenta)}</span></div>
            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-5 bg-green-600 text-black rounded-2xl font-black uppercase text-[10px] active:scale-95 shadow-xl shadow-green-900/10">Continuar con Pago</button>
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE PAGO: CALCULADORA HIPER TITANIUM */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/98 backdrop-blur-2xl animate-in zoom-in-95 duration-200">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-8 w-full max-w-5xl shadow-2xl relative flex gap-10">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
            
            {/* IZQUIERDA: CLIENTE Y MÉTODO */}
            <div className="flex-1">
              <h3 className="text-3xl font-black uppercase italic text-blue-500 mb-8">Pago e Identificación</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-8 shrink-0">
                <button onClick={() => {setWithTicket(false); setIsAnonymous(true); setSelectedClient(null);}} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${!withTicket ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-black border-white/5 text-gray-600'}`}><ShieldOff size={20}/><span className="text-[9px] font-black uppercase">Venta Anónima</span></button>
                <button onClick={() => {setWithTicket(true); setIsAnonymous(false);}} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${withTicket ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-900/10' : 'bg-black border-white/5 text-gray-600'}`}><Receipt size={20}/><span className="text-[9px] font-black uppercase">Ticket WA</span></button>
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-2"><span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Registrar Cliente</span><button onClick={() => setShowNewClientForm(true)} className="text-[8px] font-black text-blue-500 flex items-center gap-1 active:scale-90"><UserPlus size={10}/> Nuevo</button></div>
                <input type="text" placeholder="BUSCAR POR NOMBRE O TELÉFONO..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 font-black uppercase text-[10px] outline-none mb-2 focus:border-green-600 transition-colors" />
                <div className="max-h-24 overflow-y-auto no-scrollbar border-l border-white/5">
                  {clientes.filter(c => cleanText(c.nombre).includes(cleanText(clientSearch)) || c.telefono?.includes(clientSearch)).map(c => (
                    <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch(c.nombre);}} className={`w-full p-2.5 text-left text-[9px] uppercase font-black border-b border-white/5 ${selectedClient?.id === c.id ? 'text-green-500 bg-white/5' : 'text-gray-600 hover:text-white'}`}>{c.nombre} • {c.telefono || 'Sin WA'}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0 pt-4 border-t border-white/5">
                {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                  <button key={m} disabled={(isAnonymous || !selectedClient) && m === 'A Cuenta'} onClick={() => setMetodoPago(m as any)} className={`py-4 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${metodoPago === m ? 'bg-blue-600 text-white shadow-lg' : 'bg-black border-white/5 text-gray-700 disabled:opacity-30'}`}><span className="font-black uppercase text-[9px]">{m}</span></button>
                ))}
              </div>
            </div>

            {/* ✅ DERECHA: CALCULADORA HIPER TITANIUM */}
            <div className="w-[340px] bg-white/[0.02] border border-white/5 rounded-[40px] p-8 flex flex-col justify-between shrink-0 shadow-2xl">
                <div>
                  <div className="text-center mb-8"><p className="text-[9px] font-black text-gray-500 uppercase">Cobro Total</p><p className="text-4xl font-black italic tracking-tighter text-white">{formatCurrency(totalVenta)}</p></div>

                  {metodoPago === 'Efectivo' && (
                    <div className="space-y-6">
                      <div className={`text-center py-6 rounded-3xl border animate-in slide-in-from-top duration-300 ${cambio >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                         <p className={`text-[9px] font-black uppercase mb-1 ${cambio >= 0 ? 'text-green-500' : 'text-red-500'}`}>Cambio Sugerido</p>
                         <p className={`text-5xl font-black italic tracking-tighter ${cambio >= 0 ? 'text-white' : 'text-red-500'}`}>{formatCurrency(cambio)}</p>
                      </div>

                      <div className="bg-black border border-white/10 rounded-2xl p-4">
                        <label className="text-[7px] font-black text-gray-600 uppercase block mb-1">Entregó:</label>
                        <div className="flex items-center gap-2">
                           <Banknote size={20} className="text-gray-600" />
                           <input type="number" value={pagoCon} onChange={(e) => setPagoCon(e.target.value)} className="bg-transparent w-full text-3xl font-black text-white outline-none" placeholder="0.00" autoFocus />
                        </div>
                      </div>

                      {/* ✅ ACCESO RÁPIDO BILLETES TITANIUM CON CÓDIGO DE COLOR */}
                      <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest ml-2">Toque rápido (Billetes)</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {val: 20, col: "border-blue-500/30 text-blue-400 bg-blue-600/5 hover:bg-blue-600"},
                          {val: 50, col: "border-pink-500/30 text-pink-400 bg-pink-600/5 hover:bg-pink-600"},
                          {val: 100, col: "border-red-500/30 text-red-400 bg-red-600/5 hover:bg-red-600"},
                          {val: 200, col: "border-green-500/30 text-green-400 bg-green-600/5 hover:bg-green-600"},
                          {val: 500, col: "border-yellow-500/30 text-yellow-400 bg-yellow-600/5 hover:bg-yellow-600"},
                          {val: 1000, col: "border-white/20 text-white bg-white/5 hover:bg-white hover:text-black"}
                        ].map(b => (
                          <button key={b.val} onClick={() => setPagoCon(b.val.toString())} className={`py-5 rounded-xl text-[11px] border font-black transition-all active:scale-90 ${b.col}`}>${b.val}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {metodoPago === 'A Cuenta' && selectedClient && (
                    <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-6 text-center animate-in slide-in-from-top duration-300">
                       <p className="text-[9px] font-black text-blue-400 uppercase mb-2">Nuevo Saldo Deudor:</p>
                       <p className="text-3xl font-black text-white">{formatCurrency((selectedClient.saldo_deudor || 0) + totalVenta)}</p>
                    </div>
                  )}
                </div>
                
                <button onClick={finalizarVenta} disabled={isPaymentDisabled} className={`w-full py-6 rounded-[25px] font-black uppercase text-[10px] shadow-2xl transition-all ${isPaymentDisabled ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-white text-black active:scale-95 active:shadow-inner'}`}>
                  {isSubmitting ? 'GUARDANDO...' : 'Confirmar y Finalizar Venta'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {showNewClientForm && (
        <div className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in-95 duration-100">
          <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-[40px] w-full max-w-sm">
            <h3 className="text-xl font-black uppercase italic mb-6">Nuevo Cliente Amoree</h3>
            <div className="space-y-4">
              <input type="text" placeholder="NOMBRE COMPLETO" value={newClient.nombre} onChange={(e) => setNewClient({...newClient, nombre: e.target.value})} className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-black uppercase text-green-500 outline-none focus:border-green-600 transition-all" />
              <input type="number" placeholder="TELÉFONO WA (10 DÍGITOS)" value={newClient.telefono} onChange={(e) => setNewClient({...newClient, telefono: e.target.value})} className="w-full bg-black border border-white/10 p-4 rounded-xl text-xs font-black outline-none focus:border-green-600 transition-all" />
              <div className="flex gap-3 pt-4"><button onClick={() => setShowNewClientForm(false)} className="flex-1 bg-white/5 py-4 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-colors">Cerrar</button><button onClick={crearNuevoCliente} className="flex-1 bg-blue-600 py-4 rounded-xl text-[10px] font-black uppercase text-white hover:bg-blue-500 active:scale-95 transition-all">Guardar Cliente</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
