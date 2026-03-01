import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats'>('orders');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('pedidos').select('*');
    if (data) {
      // PRIORIDADES: 1. Pendiente, 2. Pendiente de Pago, 3. Pagado, 4. Cancelado
      const statusWeight: Record<string, number> = {
        'Pendiente': 1,
        'Pendiente de Pago': 2,
        'Pagado': 3,
        'Cancelado': 4
      };
      const sorted = data.sort((a, b) => (statusWeight[a.estado] || 5) - (statusWeight[b.estado] || 5));
      setOrders(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // --- FUNCIÓN MAESTRA: ENVIAR TICKET DIGITAL ---
  const sendDigitalTicket = async (order: any) => {
    // 1. Limpiar el teléfono del cliente (quitar paréntesis y notas)
    const rawPhone = order.telefono_cliente.split(' ')[0].replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;

    // 2. Construir el Ticket con pesos reales
    let ticket = `*TICKET DIGITAL - AMOREE* ✅\n`;
    ticket += `_Tu pedido ya está pesado y listo_\n`;
    ticket += `--------------------------\n`;
    order.detalle_pedido.forEach((item: any) => {
      const subtotal = item.precio_venta * item.quantity;
      ticket += `• ${item.quantity.toFixed(3)} ${item.unidad} x ${item.nombre} = ${formatCurrency(subtotal)}\n`;
    });
    ticket += `--------------------------\n`;
    ticket += `💰 *TOTAL A PAGAR: ${formatCurrency(order.total)}*\n\n`;
    ticket += `¿Confirmamos el envío a tu domicilio? 🥑`;

    // 3. Actualizar estado en Supabase a "Pendiente de Pago"
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        estado: 'Pendiente de Pago',
        detalle_pedido: order.detalle_pedido,
        total: order.total 
      })
      .eq('id', order.id);

    if (!error) {
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(ticket)}`;
      window.open(waUrl, '_blank');
      fetchOrders();
    }
  };

  const finalizeOrder = async (orderId: number) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Pagado' }).eq('id', orderId);
    if (!error) fetchOrders();
  };

  const updateItemQuantity = (orderId: number, itemIdx: number, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = [...order.detalle_pedido];
        newDetails[itemIdx] = { ...newDetails[itemIdx], quantity: newQty };
        const newTotal = newDetails.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);
        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    }));
  };

  const filteredOrders = orders.filter(o => o.telefono_cliente?.includes(searchTerm));

  if (loading) return <div className="p-10 text-center font-black text-green-700 animate-pulse">CARGANDO...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Panel <span className="text-green-600">Admin</span></h1>
          <div className="flex bg-gray-200 p-1 rounded-xl">
            <button onClick={() => setView('orders')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${view === 'orders' ? 'bg-white text-green-700' : 'text-gray-500'}`}>Pedidos</button>
            <button onClick={() => setView('stats')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${view === 'stats' ? 'bg-green-600 text-white' : 'text-gray-500'}`}>Estadísticas</button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            <input type="text" placeholder="🔍 Buscar teléfono..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mb-6 p-4 rounded-2xl border-0 shadow-sm font-bold" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                  <div className={`p-4 border-b ${order.estado === 'Pendiente' ? 'bg-orange-50' : order.estado === 'Pendiente de Pago' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-2">
                      <span>ID: #{order.id}</span>
                      <span className={`px-2 py-0.5 rounded-full ${order.estado === 'Pendiente de Pago' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{order.estado}</span>
                    </div>
                    <p className="font-black text-gray-800">{order.telefono_cliente}</p>
                  </div>

                  <div className="p-4 flex-1 space-y-2">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border">
                        <span className="flex-1 text-[11px] font-bold">{item.nombre}</span>
                        <input 
                          type="number" step="0.001" value={item.quantity}
                          onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                          className="w-16 border-2 border-green-200 rounded-lg text-center font-black text-xs text-green-700"
                        />
                        <span className="text-[9px] font-bold text-gray-400 w-8">{item.unidad}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-gray-50 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-gray-400">TOTAL:</span>
                      <span className="text-xl font-black text-gray-900">{formatCurrency(order.total)}</span>
                    </div>

                    {order.estado === 'Pendiente' && (
                      <button onClick={() => sendDigitalTicket(order)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
                        🚀 Enviar Ticket (WhatsApp)
                      </button>
                    )}

                    {order.estado === 'Pendiente de Pago' && (
                      <button onClick={() => finalizeOrder(order.id)} className="w-full bg-green-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
                        💰 Confirmar Pago Recibido
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <Dashboard />}
      </div>
    </div>
  );
}
