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
      const statusWeight: Record<string, number> = {
        'Pendiente': 1,
        'Pendiente de Pago': 2,
        'Pagado - Por Entregar': 3,
        'Finalizado': 4,
        'Cancelado': 5
      };
      const sorted = data.sort((a, b) => (statusWeight[a.estado] || 6) - (statusWeight[b.estado] || 6));
      setOrders(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const sendDigitalTicket = async (order: any) => {
    const rawPhone = order.telefono_cliente.split(' ')[0].replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;
    const datosBancarios = { banco: "BBVA / BANCOPPEL", nombre: "HUGO [APELLIDO]", clabe: "0123 4567 8901 2345 67", tarjeta: "4152 0000 0000 0000" };

    let ticket = `*TICKET DIGITAL - AMOREE* ✅\n_Pedido pesado y listo_\n--------------------------\n`;
    order.detalle_pedido.forEach((item: any) => {
      ticket += `• ${item.quantity.toFixed(3)} ${item.unidad} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
    });
    ticket += `--------------------------\n💰 *TOTAL: ${formatCurrency(order.total)}*\n\n`;
    ticket += `*PAGO:* 🏦\n• *Banco:* ${datosBancarios.banco}\n• *CLABE:* \`${datosBancarios.clabe}\`\n\n_Envía tu comprobante para liberar el envío._ 🥑`;

    const { error } = await supabase.from('pedidos').update({ estado: 'Pendiente de Pago', detalle_pedido: order.detalle_pedido, total: order.total }).eq('id', order.id);
    if (!error) { window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(ticket)}`, '_blank'); fetchOrders(); }
  };

  const updateStatus = async (orderId: number, nextStatus: string) => {
    const { error } = await supabase.from('pedidos').update({ estado: nextStatus }).eq('id', orderId);
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

  if (loading) return <div className="p-10 text-center font-black text-green-700 animate-pulse">Sincronizando...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black italic uppercase">Panel <span className="text-green-600">Admin</span></h1>
          <div className="flex bg-gray-200 p-1 rounded-xl">
            <button onClick={() => setView('orders')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${view === 'orders' ? 'bg-white text-green-700' : 'text-gray-500'}`}>Pedidos</button>
            <button onClick={() => setView('stats')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${view === 'stats' ? 'bg-green-600 text-white' : 'text-gray-500'}`}>Estadísticas</button>
          </div>
        </div>

        {view === 'orders' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.filter(o => o.telefono_cliente?.includes(searchTerm)).map((order) => (
              <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <div className={`p-4 border-b ${order.estado === 'Pendiente' ? 'bg-orange-50' : order.estado === 'Pendiente de Pago' ? 'bg-blue-50' : order.estado === 'Pagado - Por Entregar' ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-gray-400">#{order.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${order.estado === 'Pagado - Por Entregar' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>{order.estado}</span>
                  </div>
                  <p className="font-black text-gray-800 text-sm">{order.telefono_cliente}</p>
                </div>

                <div className="p-4 flex-1 space-y-2">
                  {order.detalle_pedido?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border text-[11px] font-bold">
                      <span className="flex-1">{item.nombre}</span>
                      <input type="number" step="0.1" value={item.quantity} onChange={e => updateItemQuantity(order.id, idx, parseFloat(e.target.value))} className="w-16 border-2 border-green-200 rounded-lg text-center" />
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-gray-50 border-t mt-auto">
                  <p className="text-right text-lg font-black text-gray-900 mb-4">{formatCurrency(order.total)}</p>

                  {order.estado === 'Pendiente' && (
                    <button onClick={() => sendDigitalTicket(order)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">🚀 Enviar Ticket</button>
                  )}

                  {order.estado === 'Pendiente de Pago' && (
                    <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">💰 Confirmar Pago</button>
                  )}

                  {order.estado === 'Pagado - Por Entregar' && (
                    <button onClick={() => updateStatus(order.id, 'Finalizado')} className="w-full bg-gray-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">📦 Marcar como Entregado</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <Dashboard />}
      </div>
    </div>
  );
}
