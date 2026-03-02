import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

interface POSProps {
  onBack: () => void;
}

export default function POS({ onBack }: POSProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Cargar productos de Supabase
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('productos').select('*');
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  // 2. Agregar al carrito de la TPV
  const addToCart = (product: any) => {
    const exists = cart.find(item => item.sku === product.sku);
    if (exists) return; // Si ya está, solo editamos el peso en la lista
    setCart([...cart, { ...product, quantity: 1 }]);
  };

  const updateWeight = (sku: string, weight: number) => {
    setCart(cart.map(item => item.sku === sku ? { ...item, quantity: weight } : item));
  };

  const removeItem = (sku: string) => {
    setCart(cart.filter(item => item.sku !== sku));
  };

  const totalVenta = cart.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);

  // 3. FINALIZAR VENTA (La magia del Mostrador)
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const nuevoPedido = {
      telefono_cliente: "Venta Local (Mostrador)",
      total: totalVenta,
      estado: "Pagado", // Se marca como pagado de inmediato
      origen: "Mostrador", // <--- AQUÍ ESTÁ EL PASO 1 QUE HICISTE
      detalle_pedido: cart.map(item => ({
        sku: item.sku,
        nombre: item.nombre,
        quantity: item.quantity,
        precio_venta: item.precio_venta,
        unidad: item.unidad,
        costo: item.costo // Guardamos el costo para el Dashboard
      }))
    };

    const { error } = await supabase.from('pedidos').insert([nuevoPedido]);

    if (!error) {
      alert('✅ ¡VENTA REGISTRADA CON ÉXITO!');
      setCart([]);
      onBack(); // Regresamos al panel
    } else {
      alert('Error al registrar la venta');
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col md:flex-row">
      
      {/* SECCIÓN IZQUIERDA: BUSCADOR Y PRODUCTOS */}
      <div className="flex-1 flex flex-col border-r border-gray-100 bg-gray-50/50">
        <div className="p-4 bg-white border-b flex items-center gap-4">
          <button onClick={onBack} className="text-2xl p-2">⬅️</button>
          <input 
            type="text" 
            placeholder="🔍 BUSCAR PRODUCTO..." 
            className="flex-1 p-4 rounded-2xl bg-gray-100 font-black text-lg outline-none focus:ring-4 focus:ring-green-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredProducts.map(p => (
            <button 
              key={p.sku} 
              onClick={() => addToCart(p)}
              className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 hover:border-green-500 hover:scale-105 transition-all flex flex-col items-center text-center"
            >
              <img src={p.url_imagen} className="w-16 h-16 object-cover rounded-full mb-2" />
              <p className="text-[10px] font-black uppercase tracking-tighter leading-none h-6 flex items-center">{p.nombre}</p>
              <p className="text-xs font-black text-green-600 mt-2">{formatCurrency(p.precio_venta)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* SECCIÓN DERECHA: TICKET Y COBRO */}
      <div className="w-full md:w-96 bg-white shadow-2xl flex flex-col">
        <div className="p-6 bg-gray-900 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Caja Amoree</p>
          <h2 className="text-2xl font-black italic uppercase italic">Punto de Venta</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.map(item => (
            <div key={item.sku} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 relative group">
              <button onClick={() => removeItem(item.sku)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-[10px]">✕</button>
              <p className="text-[11px] font-black uppercase text-gray-800 mb-2">{item.nombre}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input 
                    type="number" step="0.001" value={item.quantity}
                    onChange={(e) => updateWeight(item.sku, parseFloat(e.target.value))}
                    className="w-20 p-2 border-2 border-green-200 rounded-xl font-black text-center text-sm outline-none"
                  />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{item.unidad}</span>
                </div>
                <p className="font-black text-gray-900">{formatCurrency(item.precio_venta * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-black text-gray-400 uppercase">Total a Cobrar</span>
            <span className="text-3xl font-black text-gray-900 tracking-tighter">{formatCurrency(totalVenta)}</span>
          </div>
          <button 
            disabled={loading || cart.length === 0}
            onClick={handleCheckout}
            className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-green-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'REGISTRANDO...' : '💰 FINALIZAR VENTA'}
          </button>
        </div>

        {/* SELLO DE GARANTÍA */}
        <div className="p-4 text-center opacity-20 grayscale">
          <p className="text-[8px] font-black uppercase tracking-[0.4em]">Automatiza con Raul • TPV Certified</p>
        </div>
      </div>

    </div>
  );
}
