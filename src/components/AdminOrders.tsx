import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Cargar pedidos pendientes
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('estado', 'Pendiente')
      .order('created_at', { ascending: false });

    if (!error) setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // 2. Función para actualizar el peso/cantidad de un item
  const updateItemQuantity = (orderId: number, itemIndex: number, newQty: number) => {
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const newDetails = [...order.detalle_pedido];
        newDetails[itemIndex].quantity = newQty;
        // Recalculamos el total del pedido localmente
        const newTotal = newDetails.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);
        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    });
    setOrders(updatedOrders);
  };

  // 3. Enviar Ticket Final y marcar como Completado
  const finalizeOrder = async (order: any) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        detalle_pedido: order.detalle_pedido, 
        total: order.total,
        estado: 'Completado' 
      })
      .eq('id', order.id);

    if (error) {
      alert('Error al guardar cambios');
      return;
    }

    // ARMAR MENSAJE DE TICKET FINAL
    let ticket = `✅ *TICKET DE VENTA - AMOREE*\n`;
    ticket += `¡Hola! Tu pedido ya fue pesado y está listo:\n`;
    ticket += `--------------------------\n`;
    order.detalle_pedido.forEach((item: any) => {
      ticket += `• ${item.quantity} ${item.unidad} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
    });
    ticket += `--------------------------\n`;
    ticket += `💰 *TOTAL FINAL: ${formatCurrency(order.total)}*\n\n`;
    ticket += `🛵 El repartidor va en camino. ¡Gracias por tu compra!`;

    // Enviar al teléfono del cliente que guardamos
    const whatsappUrl = `https://wa.me/52${order.telefono_cliente}?text=${encodeURIComponent(ticket)}`;
    window.open(whatsappUrl, '_blank');
    fetchOrders(); // Refrescar lista
  };

  if (loading) return <p className="p-4">Cargando pedidos de Amoree...</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-green-800">Panel de Pesaje - Amoree</h1>
      {orders.length === 0 ? <p>No hay pedidos pendientes por pesar. ✅</p> : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white border-2 border-green-100 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between mb-2 border-b pb-2">
                <span className="text-xs font-bold text-gray-400">ID: #{order.id}</span>
                <span className="text-sm font-bold text-green-600">📞 {order.telefono_cliente}</span>
              </div>
              
              <div className="space-y-3">
                {order.detalle_pedido.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <span className="text-sm flex-1">{item.nombre} ({item.unidad})</span>
                    <input 
                      type="number" 
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                      className="w-24 border rounded p-1 text-center font-bold bg-yellow-50"
                    />
                    <span className="text-sm w-20 text-right">{formatCurrency(item.precio_venta * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t flex justify-between items-center">
                <div className="text-lg font-black text-green-800">
                  Total Final: {formatCurrency(order.total)}
                </div>
                <button 
                  onClick={() => finalizeOrder(order)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-green-700"
                >
                  Confirmar y Enviar Ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
