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
    const { data } = await supabase.from('productos').select('*');
    if (data) setProducts(data);
  };

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre');
    if (data) setClientes(data);
  };

  const addToCart = (product: any) => {
    const exists = cart.find(item => item.sku === product.sku);
    if (!exists) setCart([...cart, { ...product, quantity: 1 }]);
  };

  const updateWeight = (sku: string, weight: number) => {
    setCart(cart.map(item => item.sku === sku ? { ...item, quantity: weight } : item));
  };

  const totalVenta = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const handleFinalize = async () => {
    if (cart.length === 0) return;
    setLoading(true);

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

    const { error: errorPedido } = await supabase.from('pedidos').insert([nuevoPedido]);

    if (!errorPedido) {
      if (esACuenta && clienteSeleccionado) {
        // --- AQUÍ CONECTAMOS CON LA JOYA 1 ---
        await supabase.rpc('incrementar_deuda_cliente', { 
          cliente_id: clienteSeleccionado.id, 
          monto: totalVenta 
        });
      }
      alert('✅ ¡Venta registrada con éxito!');
      onBack();
    } else {
      alert('Error al registrar la venta en la base de datos.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col md:flex-row font-sans">
      
      {/* SECCIÓN PRODUCTOS */}
      <div className="flex-1 flex flex-col border-r border-gray-200">
        <div className="p-4 bg-white border-b flex items-center gap-4">
          <button onClick={onBack} className="text-2xl p-2 hover:bg-gray-100 rounded-full transition-all">⬅️</button>
          <input 
            type="text" placeholder="🔍 BUSCAR PRODUCTO..." 
            className="flex-1 p-4 rounded-2xl bg-gray-100 font-black text-lg outline-none focus:ring-4 focus:ring-green-100 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())).map(p => (
            <button key={p.sku} onClick={() => addToCart(p)} className="bg-white p-4 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-green-500 hover:scale-[1.02] transition-all flex flex-col items-center text-center group">
              <img src={p.url_imagen} className="w-20 h-20 object-cover rounded-full mb-3 shadow-md group-hover:rotate-6 transition-transform" />
              <p className="text-[10px] font-black uppercase text-gray-400 leading-tight h-8 flex items-center">{p.nombre}</p>
              <p className="text-sm font-black text-green-600 mt-2">{formatCurrency(p.precio_venta)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN CAJA / TICKET */}
      <div className="w-full md:w-[420px] bg-white shadow-2xl flex flex-col">
        <div className="p-8 bg-gray-900 text-white rounded-bl-[3rem]">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Terminal Punto de Venta</p>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Caja <span className="text-green-500">Amoree</span></h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.map(item => (
            <div key={item.sku} className="bg-gray-50 p-4 rounded-3xl border border-gray-100 relative">
              <button onClick={() => setCart(cart.filter(i => i.sku !== item.sku))} className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full text-xs font-black shadow-lg">✕</button>
              <p className="text-[11px] font-black uppercase text-gray-800 mb-3 tracking-tighter">{item.nombre}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input 
                    type="number" step="0.001" value={item.quantity}
                    onChange={(e) => updateWeight(item.sku, parseFloat(e.target.value))}
                    className="w-24 p-2 bg-white border-2 border-green-100 rounded-xl font-black text-center text-sm outline-none focus:border-green-500 transition-all"
                  />
                  <span className="text-[10px] font-black text-gray-400 uppercase">{item.unidad}</span>
                </div>
                <p className="font-black text-gray-900">{formatCurrency(item.precio_venta * item.quantity)}</p>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
               <span className="text-6xl mb-4">🛒</span>
               <p className="font-black uppercase text-[10px] tracking-widest">Carrito Vacío</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100">
          <div className="flex justify-between items-end mb-8">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total a Pagar</p>
            <p className="text-4xl font-black text-gray-900 tracking-tighter leading-none">{formatCurrency(totalVenta)}</p>
          </div>
          <button 
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
            className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-green-100 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-30"
          >
            💰 FINALIZAR VENTA
          </button>
        </div>
      </div>

      {/* MODAL DE PAGO INTEGRADO */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black uppercase italic mb-8 text-center tracking-tighter">Seleccionar Pago</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <button 
                  key={m} onClick={() => setMetodo(m)}
                  className={`py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] border-2 transition-all ${
                    metodo === m ? 'bg-gray-900 text-white border-gray-900 shadow-xl scale-105' : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {metodo === 'A Cuenta' && (
              <div className="mb-8 animate-in slide-in-from-top-2">
                <p className="text-[11px] font-black text-gray-400 uppercase mb-3 tracking-widest">Seleccionar Cliente Deudor</p>
                <select 
                  onChange={(e) => setClienteSeleccionado(clientes.find(c => c.id === parseInt(e.target.value)))}
                  className="w-full p-5 rounded-2xl bg-gray-100 font-black text-sm border-0 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                >
                  <option value="">-- ¿Quién debe? --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} (Debe: {formatCurrency(c.saldo_deudor)})</option>
                  ))}
                </select>
                {clienteSeleccionado && (
                   <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase">Nueva Deuda Estimada</p>
                      <p className="text-xl font-black text-blue-900">{formatCurrency(clienteSeleccionado.saldo_deudor + totalVenta)}</p>
                   </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <button 
                onClick={handleFinalize}
                disabled={loading || (metodo === 'A Cuenta' && !clienteSeleccionado)}
                className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-20 transition-all"
              >
                {loading ? 'PROCESANDO...' : 'CONFIRMAR OPERACIÓN'}
              </button>
              <button onClick={() => setShowPayment(false)} className="py-2 font-black text-[10px] text-gray-400 uppercase tracking-widest">Volver</button>
            </div>
          </div>
        </div>
      )}

      {/* SELLO DE GARANTÍA */}
      <div className="fixed bottom-6 left-6 opacity-20 pointer-events-none hidden md:block">
        <p className="text-[8px] font-black uppercase tracking-[0.5em] text-gray-900">Automatiza con Raul • TPV Master</p>
      </div>

    </div>
  );
}
