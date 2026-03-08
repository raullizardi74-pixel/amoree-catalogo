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

  // REGISTRO DE CLIENTE CON COLUMNA CORRECTA: saldo_deudor
  const handleCreateCliente = async () => {
    if (!nuevoNombre || !nuevoTelefono) {
      alert("⚠️ Ingresa nombre y teléfono.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert([{ 
          nombre: nuevoNombre.toUpperCase(), 
          telefono: nuevoTelefono,
          saldo_deudor: 0 // Usando el nombre correcto de columna
        }])
        .select()
        .single();

      if (error) throw error;
      
      await fetchClientes();
      setClienteSeleccionado(data);
      setShowNewCliente(false);
      setNuevoNombre('');
      setNuevoTelefono('');
      alert("✅ Cliente registrado y seleccionado");
    } catch (err: any) {
      alert("Error al registrar cliente: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // FINALIZACIÓN DE VENTA
  const handleFinalize = async () => {
    if (cart.length === 0) return;
    if (metodo === 'A Cuenta' && !clienteSeleccionado) {
      alert("🚨 Selecciona un cliente para la venta A CUENTA.");
      return;
    }

    setLoading(true);

    try {
      const esACuenta = metodo === 'A Cuenta';
      const nuevoPedido = {
        telefono_cliente: esACuenta ? `A CUENTA: ${clienteSeleccionado.nombre}` : "Venta Mostrador",
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

      const { error: errorPed } = await supabase.from('pedidos').insert([nuevoPedido]);
      if (errorPed) throw errorPed;

      if (esACuenta && clienteSeleccionado) {
        // Asegúrate de que tu RPC interna también use saldo_deudor o actualiza directamente:
        await supabase.rpc('incrementar_deuda_cliente', { 
          cliente_id: clienteSeleccionado.id, 
          monto: totalVenta 
        });
      }

      for (const item of cart) {
        const { data: prodData } = await supabase.from('productos').select('stock_actual').eq('sku', item.sku).single();
        const nuevoStock = (prodData?.stock_actual || 0) - item.quantity;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('sku', item.sku);
      }

      alert('🚀 Venta finalizada con éxito');
      onBack();

    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col md:flex-row font-sans text-white">
      {/* PRODUCTOS */}
      <div className="flex-1 flex flex-col border-r border-white/5 bg-[#080808]">
        <div className="p-6 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center gap-6">
          <button onClick={onBack} className="text-2xl p-3 hover:bg-white/10 rounded-2xl transition-all">🔙</button>
          <input 
            type="text" placeholder="BUSCAR PRODUCTO..." 
            className="flex-1 p-5 rounded-[24px] bg-white/5 border border-white/10 font-black text-lg outline-none focus:ring-2 focus:ring-green-500/50"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())).map(p => (
            <button key={p.sku} onClick={() => addToCart(p)} disabled={p.stock_actual <= 0} className="bg-white/5 p-6 rounded-[40px] border border-white/5 hover:scale-[1.03] transition-all flex flex-col items-center">
              <img src={p.url_imagen} className="w-24 h-24 object-cover rounded-full mb-4 shadow-2xl" />
              <p className="text-[10px] font-black uppercase text-gray-500 mb-2">{p.nombre}</p>
              <p className="text-lg font-black text-green-500">{formatCurrency(p.precio_venta)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* CAJA */}
      <div className="w-full md:w-[450px] bg-black flex flex-col shadow-2xl">
        <div className="p-10 border-b border-white/5">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Caja <span className="text-green-500">Amoree</span></h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {cart.map(item => (
            <div key={item.sku} className="bg-white/[0.03] p-6 rounded-[32px] border border-white/5">
              <p className="text-xs font-black uppercase text-gray-300 mb-4">{item.nombre}</p>
              <div className="flex items-center justify-between">
                <input type="number" step="0.05" value={item.quantity} onChange={(e) => updateWeight(item.sku, parseFloat(e.target.value))} className="w-24 p-3 bg-black border border-white/10 rounded-xl font-black text-green-500 text-center" />
                <p className="text-xl font-black text-white">{formatCurrency(item.precio_venta * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-10 border-t border-white/5">
          <div className="flex justify-between items-end mb-10">
            <p className="text-[10px] font-black text-gray-500 uppercase">Total</p>
            <p className="text-5xl font-black text-white">{formatCurrency(totalVenta)}</p>
          </div>
          <button disabled={cart.length === 0 || loading} onClick={() => setShowPayment(true)} className="w-full bg-green-600 text-white py-6 rounded-[28px] font-black uppercase tracking-widest">💰 FINALIZAR VENTA</button>
        </div>
      </div>

      {/* MODAL PAGO */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 z-[100]">
          <div className="bg-[#0A0A0A] w-full max-w-xl rounded-[60px] p-10 border border-white/10 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black uppercase mb-8 text-center text-gray-400">Método de Pago</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-10">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <button key={m} onClick={() => { setMetodo(m); if(m !== 'A Cuenta') setClienteSeleccionado(null); }} className={`py-5 rounded-[25px] font-black text-[9px] uppercase border-2 transition-all ${metodo === m ? 'bg-green-500 text-white border-green-500' : 'bg-white/5 text-gray-600 border-white/5'}`}>{m}</button>
              ))}
            </div>

            {metodo === 'A Cuenta' && (
              <div className="mb-10 p-8 bg-white/5 rounded-[40px] border border-white/10">
                {!showNewCliente ? (
                  <>
                    <p className="text-[10px] font-black uppercase text-green-500 mb-5">Cartera de Clientes</p>
                    <select 
                      className="w-full p-5 bg-black border border-white/20 rounded-2xl font-black text-sm mb-6 text-white outline-none"
                      value={clienteSeleccionado?.id || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const cli = clientes.find(c => String(c.id) === String(id));
                        setClienteSeleccionado(cli);
                      }}
                    >
                      <option value="" disabled>-- SELECCIONAR CLIENTE --</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id} className="text-white bg-black">
                          {c.nombre} (Saldo: {formatCurrency(c.saldo_deudor || 0)})
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setShowNewCliente(true)} className="w-full py-4 border border-dashed border-white/20 rounded-2xl text-[10px] font-black text-gray-500 uppercase">+ Registro Express</button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-amber-500">Nuevo Socio</p>
                    <input type="text" placeholder="NOMBRE" className="w-full p-5 bg-black border border-white/10 rounded-2xl text-white uppercase" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                    <input type="text" placeholder="WHATSAPP" className="w-full p-5 bg-black border border-white/10 rounded-2xl text-white" value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={handleCreateCliente} className="flex-1 bg-white text-black py-4 rounded-xl font-black text-[9px] uppercase">Guardar</button>
                      <button onClick={() => setShowNewCliente(false)} className="px-6 bg-red-500/20 text-red-500 rounded-xl font-black">X</button>
                    </div>
                  </div>
                )}
                {clienteSeleccionado && !showNewCliente && <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex justify-between"><span className="text-[10px] font-black text-green-500 uppercase">Seleccionado: {clienteSeleccionado.nombre}</span></div>}
              </div>
            )}

            <button disabled={loading || (metodo === 'A Cuenta' && !clienteSeleccionado)} onClick={handleFinalize} className="w-full bg-green-600 text-white py-6 rounded-[30px] font-black uppercase text-xs tracking-widest disabled:opacity-20">{loading ? 'SINCRONIZANDO...' : 'Sellar Venta'}</button>
            <button onClick={() => { setShowPayment(false); setShowNewCliente(false); setClienteSeleccionado(null); }} className="w-full mt-8 text-[9px] font-black text-gray-700 uppercase">Volver</button>
          </div>
        </div>
      )}
    </div>
  );
}
