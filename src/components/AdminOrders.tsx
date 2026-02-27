import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargamos todos los pedidos recientes para tener control total
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20); // Mostramos los últimos 20 pedidos

    if (!error) setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // 2. Función para actualizar el ESTADO en Supabase
  const handleStatusChange = async (orderId: number, newStatus: string) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Error al actualizar el estado');
    } else {
      fetchOrders(); // Refrescar para ver el cambio
    }
  };

  const updateItemQuantity = (orderId: number, itemIndex: number, newQty: number) => {
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const newDetails = [...order.detalle_pedido];
        newDetails[itemIndex].quantity = newQty;
        const newTotal = newDetails.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);
        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    });
    setOrders(updatedOrders);
  };

  const finalizeOrder = async (order: any) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        detalle_pedido: order.detalle_pedido, 
        total: order.total,
        estado: 'Entregado' // Al enviar ticket, lo marcamos como Entregado por defecto
      })
      .eq('id', order.id);

    if (error) return alert('Error al guardar');

    let ticket = `✅ *TICKET DE VENTA - AMOREE*\n`;
    ticket += `--------------------------\n`;
    order.detalle_pedido.forEach((item: any) => {
      ticket += `• ${item.quantity} ${item.unidad} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
    });
    ticket += `--------------------------\n`;
    ticket += `💰 *TOTAL FINAL: ${formatCurrency(order.total)}*\n`;
    const whatsappUrl = `https://wa.me/52${order.telefono_cliente}?text=${encodeURIComponent(ticket)}`;
    window.open(whatsappUrl, '_blank');
    fetchOrders();
  };

  if (loading) return <p className="p-4">Cargando gestión de Amoree...</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-green-900 uppercase tracking-tighter">Gestión Amoree</h1>
        <button onClick={fetchOrders} className="text-xs bg-white border px-3 py-1 rounded shadow-sm">🔄 Refrescar</button>
      </div>

      <div className="space-y-6">
        {orders.map(order => (
          <div key={order.id} className={`bg-white rounded-2xl p-5 shadow-md border-l-8 ${
            order.estado === 'Pendiente' ? 'border-yellow-400' : 
            order.estado === 'Pagado' ? 'border-blue-500' : 'border-green-500'
          }`}>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block">PEDIDO #{order.id}</span>
                <span className="text-sm font-black text-gray-700">📞 {order.telefono_cliente}</span>
              </div>
              
              {/* SELECTOR DE ESTADO VISIBLE Y FUNCIONAL */}
              <select 
                value={order.estado || 'Pendiente'}
                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                className={`text-xs font-bold py-1 px-2 rounded-full border-0 shadow-inner ${
                  order.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' :
                  order.estado === 'Entregado' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700'
                }`}
              >
                <option value="Pendiente">⏳ PENDIENTE</option>
                <option value="Entregado">🚚 ENTREGADO</option>
                <option value="Pagado">💰 PAGADO</option>
                <option value="Cancelado">❌ CANCELADO</option>
              </select>
            </div>

            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              {order.detalle_pedido.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 font-medium">{item.nombre}</span>
                  <input 
                    type="number" step="0.001" value={item.quantity}
                    onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                    className="w-20 border-0 bg-white rounded shadow-inner text-center font-bold text-green-700"
                  />
                  <span className="text-gray-400 text-xs w-10">{item.unidad}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <span className="text-lg font-black text-gray-800">{formatCurrency(order.total)}</span>
              <button 
                onClick={() => finalizeOrder(order)}
                className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold text-xs shadow-lg shadow-green-100 hover:bg-green-700 transition-all"
              >
                Confirmar y Ticket
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
