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
    const exists = cart.find(item => item.sku === product.sku);
    if (!exists) {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateWeight = (sku: string, weight: number) => {
    setCart(cart.map(item => item.sku === sku ? { ...item, quantity: weight } : item));
  };

  const totalVenta = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  // --- FUNCIÓN DE CIERRE DE VENTA BLINDADA ---
  const handleFinalize = async () => {
    if (cart.length === 0) return;
    
    setLoading(true); // INICIA SPINNER

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
          precio_venta: item.precio_venta,
          unidad: item.unidad,
          costo: item.costo
        }))
      };

      // 1. Insertar el Pedido
      const { error: errorPedido } = await supabase.from('pedidos').insert([nuevoPedido]);
      if (errorPedido) throw errorPedido;

      // 2. Si es 'A Cuenta', incrementar deuda del cliente
      if (esACuenta && clienteSeleccionado) {
        const { error: errorDeuda } = await supabase.rpc('incrementar_deuda_cliente', { 
          cliente_id: clienteSeleccionado.id, 
          monto: totalVenta 
        });
        if (errorDeuda) throw errorDeuda;
      }

      // 3. DESCONTAR STOCK (Crítico para Hugo)
      for (const item of cart) {
        const productRef = products.find(p => p.sku === item.sku);
        if (productRef) {
          const nuevoStock = productRef.stock_actual - item.quantity;
          await supabase
            .from('productos')
            .update({ stock_actual: nuevoStock })
            .eq('sku', item.sku);
        }
      }

      alert('✅ ¡OPERACIÓN EXITOSA!');
      onBack(); // Regresa al panel principal

    } catch (error: any) {
      console.error("Fallo en la operación:", error);
      alert('❌ ERROR CRÍTICO: ' + (error.message || 'Error de conexión'));
    } finally {
      // ESTO MATA EL SPINNER PASE LO QUE PASE
      setLoading(false); 
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col md:flex-row font-sans text-white">
      
      {/* SECCIÓN PRODUCTOS (LADO IZQUIERDO) */}
      <div className="flex-1 flex flex-col border-r border-white/5 bg-[#080808]">
        <div className="p-6 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center gap-6">
          <button onClick={onBack} className="text-2xl p-3 hover:bg-white/10 rounded-2xl transition-all">🔙</button>
          <input 
            type="text" placeholder="BUSCAR PRODUCTO..." 
            className="flex-1 p-5 rounded-[24px] bg-white/5 border border-white/10 font-black text-lg outline-none focus:ring-4 focus:ring-green-500/20 transition-all text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())).map(p => (
            <button key={p.sku} onClick={() => addToCart(p)} className="bg-white/5 p-6 rounded-[40px] border border-white/5 hover:border-green-500/50 hover:scale-[1.03] transition-all flex flex-col items-center text-center group relative overflow-hidden">
              <img src={p.url_imagen} className="w-24 h-24 object-cover rounded-full mb-4 shadow-2xl group-hover:rotate-6 transition-transform" />
              <p className="text-[10px] font-black uppercase text-gray-500 leading-tight mb-2">{p.nombre}</p>
              <p className="text-lg font-black text-green-500">{formatCurrency(p.precio_venta)}</p>
              {p.stock_actual <= 0 && <div className="absolute inset-0 bg-black/80 flex items-center justify-center font-black text-red-500 text-[10px] uppercase tracking-widest">Agotado</div>}
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN CAJA / TICKET (LADO DERECHO) */}
      <div className="w-full md:w-[450px] bg-black flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-10 bg-gradient-to-br from-gray-900 to-black rounded-bl-[4rem] border-b border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500/50 mb-2">Terminal de Salida</p>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Caja <span className="text-green-500">Amoree</span></h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {cart.map(item => (
            <div key={item.sku} className="bg-white/[0.03] p-6 rounded-[32px] border border-white/5 relative group">
              <button onClick={() => setCart(cart.filter(i => i.sku !== item.sku))} className="absolute -top-2 -right-2 bg-red-600 text-white w-8 h-8 rounded-full text-xs font-black shadow-xl scale-0 group-hover:scale-100 transition-transform">✕</button>
              <p className="text-xs font-black uppercase text-gray-300 mb-4 tracking-tighter">{item.nombre}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input 
                    type="number" step="0.05" value={item.quantity}
                    onChange={(e) => updateWeight(item.sku, parseFloat(e.target.value))}
                    className="w-24 p-3 bg-black border border-white/10 rounded-xl font-black text-center text-green-500 outline-none focus:border-green-500"
                  />
                  <span className="text-[10px] font-black text-gray-600 uppercase">Unid.</span>
                </div>
                <p className="text-xl font-black text-white">{formatCurrency(item.precio_venta * item.quantity)}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center py-20">
               <span className="text-7xl mb-6 opacity-10">🛒</span>
               <p className="font-black uppercase text-[10px] tracking-[0.3em] text-gray-700">Esperando Selección</p>
            </div>
          )}
        </div>

        {/* PIE DE TICKET - ACCIÓN PRINCIPAL */}
        <div className="p-10 bg-white/[0.02] border-t border-white/5">
          <div className="flex justify-between items-end mb-10">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total de Venta</p>
            <p className="text-5xl font-black text-white tracking-tighter leading-none">{formatCurrency(totalVenta)}</p>
          </div>
          <button 
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
            className="w-full bg-green-600 text-white py-6 rounded-[28px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-green-600/20 hover:bg-green-500 active:scale-95 transition-all disabled:opacity-10"
          >
            💰 FINALIZAR VENTA
          </button>
        </div>
      </div>

      {/* MODAL DE PAGO (FULL GLASSMORPHISM) */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 z-[100]">
          <div className="bg-[#0A0A0A] w-full max-w-xl rounded-[50px] p-12 border border-white/10 shadow-2xl">
            <h3 className="text-3xl font-black uppercase italic mb-10 text-center text-white">Método de Cobro</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-10">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <button 
                  key={m} onClick={() => setMetodo(m)}
                  className={`py-6 rounded-[24px] font-black text-[10px] uppercase tracking-widest border-2 transition-all ${
                    metodo === m ? 'bg-white text-black border-white shadow-white/10 scale-105' : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {metodo === 'A Cuenta' && (
              <div className="mb-10 animate-in fade-in slide-in-from-top-4">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-widest">Cliente Deudor</p>
                <select 
                  onChange={(e) => setClienteSeleccionado(clientes.find(c => c.id === parseInt(e.target.value)))}
                  className="w-full p-6 rounded-[22px] bg-white/5 border border-white/10 font-black text-sm text-white focus:border-green-500 transition-all outline-none"
                >
                  <option value="" className="bg-black">-- Seleccionar Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id} className="bg-black">{c.nombre} (Saldo: {formatCurrency(c.saldo_deudor)})</option>
                  ))}
                </select>
                {clienteSeleccionado && (
                   <div className="mt-6 p-6 bg-green-500/5 rounded-[22px] border border-green-500/20">
                      <p className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-1">Nueva Deuda Proyectada</p>
                      <p className="text-2xl font-black text-white">{formatCurrency(clienteSeleccionado.saldo_deudor + totalVenta)}</p>
                   </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleFinalize}
                disabled={loading || (metodo === 'A Cuenta' && !clienteSeleccionado)}
                className="w-full bg-green-600 text-white py-6 rounded-[25px] font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-green-600/30 disabled:opacity-10 transition-all"
              >
                {loading ? 'PROCESANDO TRANSACCIÓN...' : 'CONFIRMAR Y REGISTRAR'}
              </button>
              <button onClick={() => setShowPayment(false)} className="py-2 font-black text-[9px] text-gray-600 uppercase tracking-[0.5em] hover:text-white transition-colors">Volver a la caja</button>
            </div>
          </div>
        </div>
      )}

      {/* INYECCIÓN DE ESTILO PARA INPUTS (Solución al contraste) */}
      <style>{`
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        select { appearance: none; }
      `}</style>
    </div>
  );
}
