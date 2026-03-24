import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { useAuth } from '../context/AuthContext';
import { 
  Search, ShoppingCart, Plus, Minus, Camera, X, 
  DollarSign, CreditCard, Smartphone, BookOpen, Send, UserPlus, ShieldOff, UserCheck, Scale 
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
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true); 
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'A Cuenta'>('Efectivo');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: p } = await supabase.from('productos').select('*').eq('activo', true);
    const { data: c } = await supabase.from('clientes').select('*').order('nombre');
    if (p) setProducts(p);
    if (c) setClientes(c);
    setLoading(false);
  };

  const productsWithAvailableStock = useMemo(() => {
    return products.map(p => {
      const inCart = cart.find(item => item.id === p.id)?.quantity || 0;
      return { ...p, available: (p.stock_actual || 0) - inCart };
    });
  }, [products, cart]);

  const addToCart = (product: any) => {
    if (product.available <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev; 
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  // ✅ SOLUCIÓN AL BUG: Función dedicada para eliminar artículos
  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // ✅ SOLUCIÓN AL BUG: updateQuantity ahora permite el '0' sin borrar
  const updateQuantity = (id: number, value: string) => {
    const numValue = parseFloat(value);
    
    // Si el campo está vacío o no es un número, mantenemos el ítem con 0 para que Hugo siga escribiendo
    if (value === '' || isNaN(numValue)) {
      setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: 0 } : item));
      return;
    }

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const pRef = products.find(p => p.id === id);
        const maxStock = pRef?.stock_actual || 0;
        // No dejamos que Hugo venda más de lo que hay, pero permitimos el 0
        const finalQty = numValue > maxStock ? maxStock : numValue;
        return { ...item, quantity: finalQty };
      }
      return item;
    }));
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * (Number(item.quantity) || 0)), 0);

  const finalizarVenta = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      let clienteFinal = { nombre: 'PÚBLICO GENERAL', telefono: '', id: null, saldo: 0 };
      if (!isAnonymous && selectedClient) clienteFinal = selectedClient;

      const { error: errPedido } = await supabase.from('pedidos').insert([{
        usuario_email: user?.email,
        nombre_cliente: clienteFinal.nombre,
        telefono_cliente: clienteFinal.telefono,
        cliente_id: clienteFinal.id,
        total: total,
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
        await supabase.from('productos').update({ stock_actual: (pRef?.stock_actual || 0) - item.quantity }).eq('id', item.id);
      }

      alert("🎉 Venta Exitosa");
      setCart([]);
      setShowPaymentModal(false);
      fetchData();
    } catch (e: any) { alert(e.message); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen p-4 bg-black text-white font-sans">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="bg-white/5 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5">← Salir</button>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg shadow-green-900/20"><Camera size={24} /></button>
        </div>
        
        <div className="relative mb-8">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 rounded-[30px] py-6 pl-16 pr-8 font-black uppercase text-sm outline-none focus:border-green-500 transition-all" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto no-scrollbar max-h-[70vh]">
          {productsWithAvailableStock.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
            <button key={product.id} onClick={() => addToCart(product)} className={`p-6 rounded-[45px] border text-left transition-all relative overflow-hidden group ${product.available <= 0 ? 'opacity-30 grayscale border-white/5' : 'bg-[#0A0A0A] border-white/5 hover:border-green-500/50 hover:bg-white/[0.02]'}`}>
              <p className="text-[8px] text-gray-600 uppercase font-black mb-1">{product.categoria}</p>
              <p className="font-black text-white uppercase text-xs mb-4 leading-tight">{product.nombre}</p>
              <div className="flex justify-between items-end">
                <p className="text-xl font-black text-green-500">{formatCurrency(product.precio_venta)}</p>
                <div className="text-right">
                  <p className={`text-[9px] font-black uppercase ${product.available < 2 ? 'text-red-500' : 'text-gray-500'}`}>Stock: {product.available.toFixed(2)}</p>
                  <p className="text-[7px] text-gray-700 font-bold uppercase">{product.unidad || 'kg'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full lg:w-[480px]">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 sticky top-6 shadow-2xl flex flex-col h-[85vh]">
          <div className="flex justify-between items-center mb-8 px-2">
            <h3 className="font-black uppercase text-xs italic flex items-center gap-2"><ShoppingCart size={16}/> Carrito de Venta</h3>
            <span className="bg-white/5 px-4 py-1 rounded-full text-[9px] font-black text-gray-500">{cart.length} ITEMS</span>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-8">
            {cart.map(item => (
              <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-[35px] p-6 group transition-all hover:bg-white/[0.04]">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase text-white mb-1 leading-none">{item.nombre}</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase">{formatCurrency(item.precio_venta)} / {item.unidad || 'kg'}</p>
                  </div>
                  {/* ✅ BOTÓN X: Ahora usa removeFromCart específicamente */}
                  <button onClick={() => removeFromCart(item.id)} className="text-gray-700 hover:text-red-500 transition-colors"><X size={16}/></button>
                </div>

                <div className="flex items-center justify-between gap-4">
                   <div className="flex items-center bg-black rounded-2xl border border-white/10 px-4 py-2 flex-1">
                      <Scale size={14} className="text-gray-600 mr-3" />
                      <input 
                        type="number" step="0.001" value={item.quantity} 
                        onChange={(e) => updateQuantity(item.id, e.target.value)}
                        className="bg-transparent w-full text-lg font-black text-green-500 outline-none"
                      />
                      <span className="text-[9px] font-black text-gray-600 uppercase ml-2">{item.unidad || 'kg'}</span>
                   </div>
                   <div className="text-right">
                     <p className="text-[8px] text-gray-600 uppercase font-black mb-1">Subtotal</p>
                     <p className="text-lg font-black text-white">{formatCurrency(item.precio_venta * (Number(item.quantity) || 0))}</p>
                   </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8">
            <div className="flex justify-between items-end mb-8 px-4">
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-[0.3em]">Total a Pagar</span>
              <span className="text-5xl font-black text-white tracking-tighter">{formatCurrency(total)}</span>
            </div>
            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full py-8 bg-green-600 text-black rounded-[35px] font-black uppercase tracking-[0.3em] text-[12px] hover:bg-green-500 transition-all shadow-xl shadow-green-900/20 active:scale-95">Cobrar Ahora</button>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-12 w-full max-w-xl shadow-2xl relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X /></button>
            <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-8 text-center">Finalizar <span className="text-green-500">Operación</span></h3>

            <div className="flex bg-black p-2 rounded-[25px] border border-white/10 mb-8">
              <button onClick={() => { setIsAnonymous(true); setSelectedClient(null); setMetodoPago('Efectivo'); }} className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${isAnonymous ? 'bg-white text-black' : 'text-gray-500'}`}><ShieldOff size={14}/> Anónimo</button>
              <button onClick={() => setIsAnonymous(false)} className={`flex-1 py-4 rounded-[20px] text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${!isAnonymous ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}><UserCheck size={14}/> Cliente</button>
            </div>

            {!isAnonymous && (
              <div className="mb-10">
                <input type="text" placeholder="BUSCAR CLIENTE..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 font-black uppercase text-xs mb-2 outline-none focus:border-green-500" />
                <div className="max-h-32 overflow-y-auto no-scrollbar">
                  {clientes.filter(c => c.nombre.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                    <button key={c.id} onClick={() => {setSelectedClient(c); setClientSearch(c.nombre);}} className={`w-full p-4 text-left border-b border-white/5 text-[10px] uppercase font-black ${selectedClient?.id === c.id ? 'text-green-500' : 'text-gray-500'}`}>{c.nombre}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-10">
              {['Efectivo', 'Tarjeta', 'Transferencia', 'A Cuenta'].map(m => (
                <button key={m} disabled={isAnonymous && m === 'A Cuenta'} onClick={() => setMetodoPago(m as any)} className={`p-6 rounded-[30px] border flex flex-col items-center gap-2 transition-all ${metodoPago === m ? 'bg-green-600 border-green-600 text-white' : 'bg-black border-white/5 text-gray-600'}`}>
                  <span className="font-black uppercase text-[10px]">{m}</span>
                </button>
              ))}
            </div>

            <button onClick={finalizarVenta} disabled={isSubmitting} className="w-full py-8 bg-white text-black rounded-[40px] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-green-500 transition-all">
              {isSubmitting ? 'GUARDANDO...' : 'CONFIRMAR VENTA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
