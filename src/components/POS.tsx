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
  
  // Para clientes y deuda
  const [clienteBusqueda, setClienteBusqueda] = useState('');
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
    const { data } = await supabase.from('clientes').select('*');
    if (data) setClientes(data);
  };

  const addToCart = (product: any) => {
    const exists = cart.find(item => item.sku === product.sku);
    if (!exists) setCart([...cart, { ...product, quantity: 1 }]);
  };

  const totalVenta = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  const handleFinalize = async () => {
    setLoading(true);
    const esACuenta = metodo === 'A Cuenta';
    
    const nuevoPedido = {
      telefono_cliente: esACuenta ? clienteSeleccionado.nombre : "Venta Mostrador",
      total: totalVenta,
      estado: esACuenta ? "Pendiente de Pago" : "Pagado",
      origen: "Mostrador",
      metodo_pago: metodo,
      cliente_id: clienteSeleccionado?.id || null,
      detalle_pedido: cart
    };

    const { error } = await supabase.from('pedidos').insert([nuevoPedido]);

    if (!error) {
      if (esACuenta && clienteSeleccionado) {
        // ACTUALIZAMOS LA DEUDA DEL CLIENTE (Magia de Automatiza con Raul)
        await supabase.rpc('increment_saldo', { 
          row_id: clienteSeleccionado.id, 
          amount: totalVenta 
        });
      }
      alert('Venta procesada con éxito 🥑');
      onBack();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex">
      {/* LADO IZQUIERDO: PRODUCTOS */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div className="flex gap-4 mb-6">
           <button onClick={onBack} className="bg-white p-4 rounded-2xl shadow-sm text-xl">⬅️</button>
           <input 
             type="text" placeholder="🔍 BUSCAR ARTÍCULO..." 
             className="flex-1 p-4 rounded-2xl border-0 shadow-sm font-black text-lg"
             onChange={(e) => setSearch(e.target.value)}
           />
        </div>
        <div className="grid grid-cols-3 gap-4 overflow-y-auto">
          {products.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase())).map(p => (
            <button key={p.sku} onClick={() => addToCart(p)} className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-green-500 transition-all flex flex-col items-center">
              <img src={p.url_imagen} className="w-20 h-20 object-cover rounded-full mb-3" />
              <p className="text-[10px] font-black uppercase text-gray-500">{p.nombre}</p>
              <p className="font-black text-green-600 mt-1">{formatCurrency(p.precio_venta)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* LADO DERECHO: TICKET */}
      <div className="w-[400px] bg-white shadow-2xl flex flex-col p-8">
        <h2 className="text-3xl font-black italic mb-8 uppercase tracking-tighter">Caja <span className="text-green-600">Amoree</span></h2>
        
        <div className="flex-1 overflow-y-auto space-y-4">
          {cart.map(item => (
            <div key={item.sku} className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
              <div>
                <p className="text-xs font-black uppercase">{item.nombre}</p>
                <input 
                  type="number" step="0.001" value={item.quantity} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCart(cart.map(i => i.sku === item.sku ? {...i, quantity: val} : i));
                  }}
                  className="w-20 bg-transparent font-black text-green-700 text-sm outline-none"
                />
              </div>
              <p className="font-black">{formatCurrency(item.precio_venta * item.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-gray-100 mt-6">
          <div className="flex justify-between items-end mb-6">
            <p className="text-[10px] font-black text-gray-400 uppercase">Total Venta</p>
            <p className="text-4xl font-black tracking-tighter">{formatCurrency(totalVenta)}</p>
          </div>
          <button 
            onClick={() => setShowPayment(true)}
            className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-green-100"
          >
            💰 Pagar / Finalizar
          </button>
        </div>
      </div>

      {/* MODAL DE PAGO (Paso 2 solicitado) */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic mb-8 text-center">Seleccionar Método</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <button 
                  key={m} onClick={() => setMetodo(m)}
                  className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${metodo === m ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-400 border-gray-100'}`}
                >
                  {m === 'Terminal' ? '💳 Terminal' : m === 'A Cuenta' ? '📝 A Cuenta' : m}
                </button>
              ))}
            </div>

            {metodo === 'A Cuenta' && (
              <div className="mb-8 animate-in fade-in zoom-in-95">
                <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Buscar Cliente (Ej. Julieta Adame)</p>
                <select 
                  onChange={(e) => setClienteSeleccionado(clientes.find(c => c.id === parseInt(e.target.value)))}
                  className="w-full p-4 rounded-2xl bg-gray-100 font-bold border-0"
                >
                  <option value="">Seleccionar Cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} (Debe: {formatCurrency(c.saldo_deudor)})</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setShowPayment(false)} className="flex-1 py-4 font-black uppercase text-[10px] text-gray-400">Cancelar</button>
              <button 
                onClick={handleFinalize}
                disabled={loading || (metodo === 'A Cuenta' && !clienteSeleccionado)}
                className="flex-[2] bg-gray-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-30"
              >
                {loading ? 'Procesando...' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
