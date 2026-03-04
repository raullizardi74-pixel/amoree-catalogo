import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function POS({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [metodo, setMetodo] = useState('Efectivo');
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
    fetchClientes();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos').select('*').order('nombre');
    if (data) setProducts(data);
  };

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre');
    if (data) setClientes(data);
  };

  const addToCart = (product: any) => {
    if (product.stock_actual <= 0) return; // Bloqueo de seguridad
    const exists = cart.find(item => item.sku === product.sku);
    if (!exists) setCart([...cart, { ...product, quantity: 1 }]);
  };

  const updateWeight = (sku: string, weight: number) => {
    const product = products.find(p => p.sku === sku);
    // Evitamos que se venda más de lo que hay en stock
    const finalWeight = weight > product.stock_actual ? product.stock_actual : weight;
    setCart(cart.map(item => item.sku === sku ? { ...item, quantity: finalWeight } : item));
  };

  const totalVenta = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const handleFinalize = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      const esACuenta = metodo === 'A Cuenta';
      const nuevoPedido = {
        telefono_cliente: esACuenta ? `A CUENTA: ${clienteSeleccionado?.nombre}` : "Venta Mostrador",
        total: totalVenta,
        estado: esACuenta ? "Pendiente de Pago" : "Pagado",
        origen: "Mostrador",
        metodo_pago: metodo,
        cliente_id: clienteSeleccionado?.id || null,
        detalle_pedido: cart.map(item => ({
          sku: item.sku,
          nombre: item.nombre,
          quantity: item.quantity,
          precio_venta: item.precio_venta
        }))
      };

      // 1. Registrar pedido
      const { error: errorPed } = await supabase.from('pedidos').insert([nuevoPedido]);
      if (errorPed) throw errorPed;

      // 2. Si es a cuenta, actualizar deuda
      if (esACuenta && clienteSeleccionado) {
        await supabase.rpc('incrementar_deuda_cliente', { 
          cliente_id: clienteSeleccionado.id, 
          monto: totalVenta 
        });
      }

      // 3. ACTUALIZACIÓN DE STOCK (LOGICA MAESTRA)
      for (const item of cart) {
        const { data: prodData } = await supabase
          .from('productos')
          .select('stock_actual')
          .eq('sku', item.sku)
          .single();
        
        const nuevoStock = (prodData?.stock_actual || 0) - item.quantity;
        
        await supabase
          .from('productos')
          .update({ stock_actual: nuevoStock })
          .eq('sku', item.sku);
      }

      alert('🚀 Venta y Stock sincronizados con éxito');
      onBack();

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col md:flex-row font-sans text-white">
      {/* SECCIÓN PRODUCTOS */}
      <div className="flex-1 flex flex-col border-r border-white/5 bg-[#080808]">
        <div className="p-6 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center gap-6">
          <button onClick={onBack} className="text-2xl p-3 hover:bg-white/10 rounded-2xl transition-all">🔙</button>
          <input 
            type="text" placeholder="BUSCAR PRODUCTO..." 
            className="flex-1 p-5 rounded-[24px] bg-white/5 border border-white/10 font-black text-lg outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())).map(p => (
            <button 
              key={p.sku} 
              onClick={() => addToCart(p)} 
              disabled={p.stock_actual <= 0}
              className={`bg-white/5 p-6 rounded-[40px] border border-white/5 hover:border-green-500/50 hover:scale-[1.03] transition-all flex flex-col items-center text-center relative group ${p.stock_actual <= 0 ? 'opacity-40 grayscale' : ''}`}
            >
              <img src={p.url_imagen} className="w-24 h-24 object-cover rounded-full mb-4 shadow-2xl" />
              <p className="text-[10px] font-black uppercase text-gray-500 leading-tight mb-2">{p.nombre}</p>
              <p className="text-lg font-black text-green-500">{formatCurrency(p.precio_venta)}</p>
              
              {/* SELLO DE AGOTADO */}
              {p.stock_actual <= 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-full rotate-[-15deg] shadow-2xl border-2 border-white">AGOTADO</span>
                </div>
              )}
              
              {/* INDICADOR DE STOCK BAJO */}
              {p.stock_actual > 0 && p.stock_actual < 5 && (
                <span className="absolute top-4 right-4 bg-amber-500 text-black text-[7px] font-black px-2 py-1 rounded-full animate-pulse">SOLO {p.stock_actual}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN CAJA (Ticket) */}
      <div className="w-full md:w-[450px] bg-black flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-10 bg-gradient-to-br from-gray-900 to-black rounded-bl-[4rem] border-b border-white/5">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Caja <span className="text-green-500">Amoree</span></h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {cart.map(item => (
            <div key={item.sku} className="bg-white/[0.03] p-6 rounded-[32px] border border-white/5 relative">
              <p className="text-xs font-black uppercase text-gray-300 mb-4">{item.nombre}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input 
                    type="number" step="0.05" value={item.quantity}
                    onChange={(e) => updateWeight(item.sku, parseFloat(e.target.value))}
                    className="w-24 p-3 bg-black border border-white/10 rounded-xl font-black text-center text-green-500"
                  />
                  <span className="text-[10px] font-black text-gray-600">Disp: {products.find(p=>p.sku===item.sku)?.stock_actual}</span>
                </div>
                <p className="text-xl font-black text-white">{formatCurrency(item.precio_venta * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-10 bg-white/[0.02] border-t border-white/5">
          <div className="flex justify-between items-end mb-10">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total</p>
            <p className="text-5xl font-black text-white">{formatCurrency(totalVenta)}</p>
          </div>
          <button 
            disabled={cart.length === 0 || loading}
            onClick={() => setShowPayment(true)}
            className="w-full bg-green-600 text-white py-6 rounded-[28px] font-black text-sm uppercase tracking-widest shadow-2xl disabled:opacity-10 transition-all"
          >
            {loading ? 'PROCESANDO...' : '💰 FINALIZAR VENTA'}
          </button>
        </div>
      </div>

      {/* MODAL PAGO */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 z-[100]">
          <div className="bg-[#0A0A0A] w-full max-w-xl rounded-[50px] p-12 border border-white/10">
            <h3 className="text-3xl font-black uppercase mb-10 text-center">Pago</h3>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <button 
                  key={m} onClick={() => setMetodo(m)}
                  className={`py-6 rounded-[24px] font-black text-[10px] uppercase border-2 transition-all ${metodo === m ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-500 border-white/5'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button 
              onClick={handleFinalize} 
              className="w-full bg-green-600 text-white py-6 rounded-[25px] font-black uppercase text-xs tracking-[0.3em]"
            >
              Confirmar Transacción
            </button>
            <button onClick={() => setShowPayment(false)} className="w-full mt-4 text-[9px] font-black text-gray-600 uppercase tracking-widest">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
