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

  // Estados para Registro de Cliente Nuevo
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchClientes();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('productos').select('*').order('nombre');
    if (data) setProducts(data);
  };

  // Función Maestra de Sincronización de Clientes
  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre');
    if (data) setClientes(data);
    if (error) console.error("Error cargando clientes:", error);
  };

  const addToCart = (product: any) => {
    if (product.stock_actual <= 0) return;
    const exists = cart.find(item => item.sku === product.sku);
    if (!exists) setCart([...cart, { ...product, quantity: 1 }]);
  };

  const updateWeight = (sku: string, weight: number) => {
    const product = products.find(p => p.sku === sku);
    const finalWeight = weight > product.stock_actual ? product.stock_actual : weight;
    setCart(cart.map(item => item.sku === sku ? { ...item, quantity: finalWeight } : item));
  };

  const totalVenta = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  // MANEJO DE ALTA DE CLIENTE
  const handleCreateCliente = async () => {
    if (!nuevoNombre || !nuevoTelefono) {
      alert("⚠️ Falta información del cliente.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{ nombre: nuevoNombre, telefono: nuevoTelefono, deuda: 0 }])
        .select()
        .single();

      if (error) throw error;
      
      // Sincronización inmediata
      await fetchClientes();
      setClienteSeleccionado(data);
      setShowNewCliente(false);
      setNuevoNombre('');
      setNuevoTelefono('');
    } catch (err: any) {
      alert("Error al registrar cliente: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // FINALIZACIÓN DE VENTA (EL CEREBRO DEL SISTEMA)
  const handleFinalize = async () => {
    if (cart.length === 0) return;
    
    if (metodo === 'A Cuenta' && !clienteSeleccionado) {
      alert("🚨 ATENCIÓN: Selecciona un cliente para registrar la deuda.");
      return;
    }

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

      // 1. Insertar Pedido
      const { error: errorPed } = await supabase.from('pedidos').insert([nuevoPedido]);
      if (errorPed) throw errorPed;

      // 2. Si es crédito, actualizar la tabla clientes (RPC)
      if (esACuenta && clienteSeleccionado) {
        const { error: errorDeuda } = await supabase.rpc('incrementar_deuda_cliente', { 
          cliente_id: clienteSeleccionado.id, 
          monto: totalVenta 
        });
        if (errorDeuda) throw errorDeuda;
      }

      // 3. Sincronizar Stock Actual
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

      // 4. ACTUALIZACIÓN POST-VENTA
      await fetchClientes(); // <-- CRÍTICO: Refresca saldos para la siguiente venta
      alert('✅ Transacción Completada');
      onBack();

    } catch (err: any) {
      alert("Error en sistema: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col md:flex-row font-sans text-white">
      {/* PANEL DE PRODUCTOS */}
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
              className={`bg-white/5 p-6 rounded-[40px] border border-white/5 hover:border-green-500/50 hover:scale-[1.03] transition-all flex flex-col items-center text-center relative ${p.stock_actual <= 0 ? 'opacity-40 grayscale' : ''}`}
            >
              <img src={p.url_imagen} className="w-24 h-24 object-cover rounded-full mb-4 shadow-2xl" />
              <p className="text-[10px] font-black uppercase text-gray-500 leading-tight mb-2">{p.nombre}</p>
              <p className="text-lg font-black text-green-500">{formatCurrency(p.precio_venta)}</p>
              {p.stock_actual <= 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-[10px] font-black px-4 py-2 rounded-full rotate-[-15deg] border-2 border-white">AGOTADO</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* PANEL DE COBRO (TICKET) */}
      <div className="w-full md:w-[450px] bg-black flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-10 bg-gradient-to-br from-gray-900 to-black border-b border-white/5">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Caja <span className="text-green-500">Amoree</span></h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {cart.map(item => (
            <div key={item.sku} className="bg-white/[0.03] p-6 rounded-[32px] border border-white/5">
              <p className="text-xs font-black uppercase text-gray-300 mb-4">{item.nombre}</p>
              <div className="flex items-center justify-between">
                <input 
                  type="number" step="0.05" value={item.quantity}
                  onChange={(e) => updateWeight(item.sku, parseFloat(e.target.value))}
                  className="w-24 p-3 bg-black border border-white/10 rounded-xl font-black text-center text-green-500"
                />
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

      {/* MODAL DE PAGO RECONSTRUIDO */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 z-[100]">
          <div className="bg-[#0A0A0A] w-full max-w-xl rounded-[60px] p-10 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black uppercase mb-8 text-center tracking-[0.2em] text-gray-400">Método de Pago</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-10">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <button 
                  key={m} onClick={() => { setMetodo(m); if(m !== 'A Cuenta') setClienteSeleccionado(null); }}
                  className={`py-5 rounded-[25px] font-black text-[9px] uppercase border-2 transition-all ${metodo === m ? 'bg-green-500 text-white border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-white/5 text-gray-600 border-white/5'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* SECCIÓN DINÁMICA DE CRÉDITO */}
            {metodo === 'A Cuenta' && (
              <div className="mb-10 p-8 bg-white/5 rounded-[40px] border border-white/10 animate-in fade-in zoom-in duration-300">
                {!showNewCliente ? (
                  <>
                    <p className="text-[10px] font-black uppercase text-green-500 mb-5 tracking-widest">Cartera de Clientes</p>
                    <select 
                      className="w-full p-5 bg-black border border-white/10 rounded-2xl font-black text-sm mb-6 outline-none focus:ring-2 focus:ring-green-500 appearance-none text-white"
                      value={clienteSeleccionado?.id || ""}
                      onChange={(e) => {
                        const sel = clientes.find(c => c.id === e.target.value);
                        setClienteSeleccionado(sel);
                      }}
                    >
                      <option value="" disabled>-- SELECCIONAR CLIENTE --</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#0A0A0A] text-white">
                          {c.nombre} (Deuda: {formatCurrency(c.deuda || 0)})
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setShowNewCliente(true)}
                      className="w-full py-4 border border-dashed border-white/20 rounded-2xl text-[10px] font-black text-gray-500 hover:text-white hover:border-white transition-all uppercase"
                    >
                      + Registrar Nuevo Cliente
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Nuevo Registro Express</p>
                    <input 
                      type="text" placeholder="NOMBRE COMPLETO" 
                      className="w-full p-5 bg-black border border-white/10 rounded-2xl font-black text-xs text-white"
                      value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                    />
                    <input 
                      type="text" placeholder="WHATSAPP (10 DÍGITOS)" 
                      className="w-full p-5 bg-black border border-white/10 rounded-2xl font-black text-xs text-white"
                      value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={handleCreateCliente} className="flex-1 bg-white text-black py-4 rounded-xl font-black text-[9px] uppercase">Guardar y Elegir</button>
                      <button onClick={() => setShowNewCliente(false)} className="px-6 bg-red-500/20 text-red-500 rounded-xl font-black text-[10px]">X</button>
                    </div>
                  </div>
                )}
                
                {clienteSeleccionado && !showNewCliente && (
                  <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-between">
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-tighter">Listo para: {clienteSeleccionado.nombre}</span>
                    <button onClick={() => setClienteSeleccionado(null)} className="text-red-500 text-[8px] font-black">QUITAR</button>
                  </div>
                )}
              </div>
            )}

            <button 
              disabled={loading || (metodo === 'A Cuenta' && !clienteSeleccionado)}
              onClick={handleFinalize} 
              className="w-full bg-green-600 text-white py-6 rounded-[30px] font-black uppercase text-xs tracking-[0.4em] shadow-[0_20px_50px_rgba(22,163,74,0.4)] disabled:opacity-20 transition-all active:scale-95"
            >
              {loading ? 'SINCRONIZANDO...' : 'Sellar Venta'}
            </button>
            
            <button 
              onClick={() => { setShowPayment(false); setShowNewCliente(false); setClienteSeleccionado(null); }} 
              className="w-full mt-8 text-[9px] font-black text-gray-700 uppercase tracking-widest hover:text-white transition-all"
            >
              Cancelar Operación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
