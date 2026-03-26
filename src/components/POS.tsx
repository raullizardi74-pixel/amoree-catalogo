import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, Plus, Minus, Camera, X, 
  DollarSign, CreditCard, Smartphone, Send, UserPlus, ShieldOff, UserCheck, Scale, Zap, Calculator 
} from 'lucide-react';

// 🛡️ NORMALIZADOR DE TEXTO PARA BÚSQUEDA FUZZY
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
  const [showScanner, setShowScanner] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true); 
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'A Cuenta'>('Efectivo');
  
  // CALCULADORA DE CAMBIO
  const [pagoCon, setPagoCon] = useState<string>('');
  const totalVenta = useMemo(() => cart.reduce((sum, item) => sum + (item.precio_venta * (Number(item.quantity) || 0)), 0), [cart]);
  const cambio = parseFloat(pagoCon) > 0 ? parseFloat(pagoCon) - totalVenta : 0;

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

  const quickAccessProducts = useMemo(() => {
    return [...products].sort((a, b) => (b.stock_actual || 0) - (a.stock_actual || 0)).slice(0, 10);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = cleanText(searchTerm);
    return products.filter(p => cleanText(p.nombre).includes(term) || cleanText(p.categoria || '').includes(term));
  }, [products, searchTerm]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      } 
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, value: string) => {
    const numValue = parseFloat(value);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (value === '' || isNaN(numValue)) return { ...item, quantity: 0 };
        return { ...item, quantity: numValue };
      }
      return item;
    }));
  };

  const finalizarVenta = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let clienteFinal = { nombre: 'PÚBLICO GENERAL', telefono: '', id: null };
      if (!isAnonymous && selectedClient) clienteFinal = selectedClient;

      const { error: errPedido } = await supabase.from('pedidos').insert([{
        usuario_email: user?.email,
        nombre_cliente: clienteFinal.nombre,
        telefono_cliente: clienteFinal.telefono,
        cliente_id: clienteFinal.id,
        total: totalVenta,
        estado: 'Finalizado',
        metodo_pago: metodoPago,
        origen: 'Mostrador',
        detalle_pedido: cart.map(item => ({
          id: item.id,
          sku: item.sku,
          nombre: item.nombre,
          quantity: item.quantity,
          price: item.precio_venta,
          unidad: item.unidad
        }))
      }]);

      if (errPedido) throw errPedido;

      for (const item of cart) {
        const pRef = products.find(p => p.id === item.id);
        await supabase.from('productos').update({ 
          stock_actual: (pRef?.stock_actual || 0) - item.quantity 
        }).eq('id', item.id);
      }

      alert(`🎉 Venta Exitosa\n------------------\nTOTAL: ${formatCurrency(totalVenta)}${metodoPago === 'Efectivo' && parseFloat(pagoCon) > 0 ? `\nPAGÓ CON: ${formatCurrency(parseFloat(pagoCon))}\nCAMBIO: ${formatCurrency(cambio)}` : ''}`);

      setCart([]);
      setPagoCon('');
      setShowPaymentModal(false);
      fetchData();
      searchInputRef.current?.focus();
    } catch (e: any) { alert(e.message); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Zap className="text-green-500 animate-pulse" size={48}/></div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col">
      {/* HEADER DINÁMICO */}
      <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <button onClick={onBack} className="bg-white/5 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5">← Salir</button>
        <div className="flex gap-4">
           <div className="hidden md:flex bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-xl items-center gap-2">
              <Zap size={14} className="text-blue-500 animate-pulse"/>
              <span className="text-[9px] font-black uppercase text-blue-400">Terminal Amoree v2</span>
           </div>
           <button onClick={() => setShowScanner(true)} className="bg-green-600 p-3 rounded-2xl shadow-lg active:scale-90"><Camera size={20} /></button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 p-4 md:p-6 gap-6">
        {/* LADO IZQUIERDO: PRODUCTOS */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="ESCRIBIR O ESCANEAR..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-full py-6 pl-16 pr-8 font-black uppercase text-sm outline-none focus:border-green-500 transition-all shadow-2xl" 
            />
          </div>

          {!searchTerm && (
            <div className="animate-in fade-in duration-500">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4 ml-4">🚀 TOP VENTAS</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-2">
                {quickAccessProducts.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} className="bg-white/5 border border-white/5 px-6 py-4 rounded-3xl whitespace-nowrap hover:bg-green-600 transition-all group">
                    <p className="text-[10px] font-black uppercase group-hover:text-black">{p.nombre}</p>
                    <p className="text-[8px] font-bold text-gray-500 group-hover:text-black/50">{formatCurrency(p.precio_venta)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto no-scrollbar max-h-[60vh] lg:max-h-none pb-20">
            {filteredProducts.map(product => (
              <button key={product.id} onClick={() => addToCart(product)} className={`p-6 rounded-[40px] border text-left transition-all relative overflow-hidden group ${product.stock_actual <= 0 ? 'opacity-20 grayscale border-white/5' : 'bg-[#0A0A0A] border-white/5 hover:border-green-500 shadow-xl hover:bg-white/[0.02]'}`}>
                <p className="text-[8px] text-gray-600 uppercase font-black mb-1">{product.categoria}</p>
                <p className="font-black text-white uppercase text-[11px] mb-4 leading-tight h-8 overflow-hidden">{product.nombre}</p>
                <div className="flex justify-between items-end">
                  <p className="text-xl font-black text-green-500">{formatCurrency(product.precio_venta)}</p>
                  <p className={`text-[9px] font-black uppercase ${product.stock_actual < 2 ? 'text-red-500' : 'text-gray-600'}`}>{product.stock_actual} {product.unidad || 'kg'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* LADO DERECHO: CARRITO (DUEÑO DE LA VERDAD) */}
        <div className="w-full lg:w-[420px] shrink-0">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-8 shadow-2xl flex flex-col h-[70vh] lg:h-[80vh] sticky top-28">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="font-black uppercase text-xs italic flex items-center gap-2"><ShoppingCart size={16} className="text-green-500"/> Carrito</h3>
              <span className="bg-white/5 px-4 py-1 rounded-full text-[9px] font-black text-gray-500">{cart.length} ARTÍCULOS</span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2">
              {cart.map(item => (
                <div key={item.id} className="bg-white/[0.03] border border-white/5 rounded-[30px] p-5 animate-in slide-in-from-right">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-black uppercase text-white flex-1 pr-4">{item.nombre}</p>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-700 hover:text-red-500 transition-colors"><X size={16}/></button>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center bg-black rounded-xl border border-white/10 px-4 py-2">
                        <Scale size={12} className="text-gray-600 mr-2" />
                        <input type="number" step="0.001" value={item.quantity} onChange={(e) => updateQuantity(item.id, e.target.value)} className="bg-transparent w-16 text-sm font-black text-green-500 outline-none" />
                        <span className="text-[8px] font-black text-gray-600 uppercase ml-1">{item.unidad || 'kg'}</span>
                     </div>
                     <p className="text-sm font-black text-white">{formatCurrency(item.precio_venta * (item.quantity || 0))}</p>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <ShoppingCart size={64} />
                  <p className="text-[10px] font-black uppercase mt-4">Esperando productos...</p>
                </div>
              )}
            </div>

            <div className="border-t border-white/5 pt-6 mt-4 shrink-0">
              <div className="flex justify-between items-end mb-6 px-2">
                <span className="text-[10px] text-gray-500 uppercase font-black">Subtotal</span>
                <span className="text-4xl font-black text-white tracking-tighter">{formatCurrency(totalVenta)}</span>
              </div>
              <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-6 bg-green-600 text-black rounded-[30px] font-black uppercase tracking-widest text-[11px] hover:bg-green-500 shadow-xl active:scale-95 transition-all">Cobrar Venta</button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE PAGO: CALCULADORA TITANIUM */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4 bg-black/98 backdrop-blur-3xl overflow-y-auto">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] md:rounded-[60px] p-6 md:p-12 w-full max-w-4xl shadow-2xl relative flex flex-col md:flex-row gap-8 my-auto">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-6 right-6 md:top-10 md:right-10 text-gray-500 hover:text-white"><X size={24}/></button>
            
            <div className="flex-1">
              <h3 className="text-2xl md:text-3xl font-black uppercase italic text-blue-500 mb-8">Finalizar Cobro</h3>
              
              <div className="flex bg-black p-1.5 rounded-2xl border border-white/10 mb-8">
                <button onClick={() => { setIsAnonymous(true); setSelectedClient(null); setMetodoPago('Efectivo'); }} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${isAnonymous ? 'bg-white text-black' : 'text-gray-500'}`}><ShieldOff size={14}/> Anónimo</button>
                <button onClick={() => setIsAnonymous(false)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${!isAnonymous ? 'bg-green-600 text-white' : 'text-gray-500'}`}><UserCheck size={14}/> Cliente</button>
              </div>

              {!isAnonymous && (
                <div className="mb-6 animate-in slide-in-from-top">
                  <input type="text" placeholder="BUSCAR CLIENTE..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 font-black uppercase text-xs outline-none focus:border-green-500" />
                  <div className="max-h-24 overflow-y-auto no-scrollbar mt-2 border-l border-white/5">
                    {clientes.filter(c => cleanText(c.nombre).includes(cleanText(clientSearch))).map(c => (
                      <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch(c.nombre);}} className={`w-full p-3 text-left text-[10px] uppercase font-black ${selectedClient?.id === c.id ? 'text-green-500' : 'text-gray-600 hover:text-white'}`}>{c.nombre}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6">
                {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                  <button key={m} disabled={isAnonymous && m === 'A Cuenta'} onClick={() => setMetodoPago(m as any)} className={`py-5 rounded-3xl border flex flex-col items-center justify-center transition-all ${metodoPago === m ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-black border-white/5 text-gray-700'}`}>
                    <span className="font-black uppercase text-[10px]">{m}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECCIÓN CALCULADORA */}
            <div className="w-full md:w-[360px] bg-white/[0.02] border border-white/5 rounded-[45px] p-8 flex flex-col">
                {metodoPago === 'Efectivo' ? (
                  <>
                    <div className="text-center mb-8 border-b border-white/5 pb-6">
                       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Cambio Sugerido</p>
                       <p className={`text-5xl font-black italic tracking-tighter ${cambio >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(cambio)}</p>
                    </div>

                    <div className="bg-black border border-white/10 rounded-3xl p-5 mb-6">
                       <label className="text-[8px] font-black text-gray-600 uppercase block mb-2 tracking-widest">El cliente entrega:</label>
                       <div className="flex items-center gap-3">
                          <DollarSign className="text-gray-600" size={24}/>
                          <input type="number" value={pagoCon} onChange={(e) => setPagoCon(e.target.value)} className="bg-transparent w-full text-4xl font-black text-white outline-none" placeholder="0.00" autoFocus />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-8">
                       {[50, 100, 200, 500].map(b => (
                         <button key={b} onClick={() => setPagoCon(b.toString())} className="bg-white/5 border border-white/5 py-4 rounded-2xl text-[10px] font-black hover:bg-white hover:text-black transition-all">${b} MXN</button>
                       ))}
                    </div>

                    <button onClick={finalizarVenta} disabled={isSubmitting || (parseFloat(pagoCon) < totalVenta && parseFloat(pagoCon) > 0)} className="w-full py-7 bg-white text-black rounded-[30px] font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all">Confirmar Venta</button>
                  </>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center py-10">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6"><CreditCard size={32} className="text-blue-500"/></div>
                    <p className="text-xs font-black uppercase text-white mb-2">Transacción Electrónica</p>
                    <p className="text-[9px] font-black text-gray-600 uppercase leading-relaxed px-4">Asegúrate de procesar el pago en la terminal antes de guardar la venta en el sistema.</p>
                    <button onClick={finalizarVenta} disabled={isSubmitting} className="w-full py-7 bg-blue-600 text-white rounded-[30px] font-black uppercase mt-10 tracking-widest text-[11px]">Guardar Venta</button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
