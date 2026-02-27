import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*');

    if (error) {
      console.error('Error:', error);
    } else if (data) {
      // --- LÓGICA DE ORDENAMIENTO PERSONALIZADO ---
      const statusWeight: Record<string, number> = {
        'Pendiente': 1,
        'Entregado': 2,
        'Pagado': 3,
        'Cancelado': 4
      };

      const sorted = data.sort((a, b) => {
        const weightA = statusWeight[a.estado] || 5;
        const weightB = statusWeight[b.estado] || 5;

        // 1. Primero ordenamos por el peso del estado
        if (weightA !== weightB) {
          return weightA - weightB;
        }

        // 2. Si son el mismo estado (ej. ambos Pendientes):
        if (a.estado === 'Pendiente') {
          // Pendientes: El más viejo arriba (Antiguo -> Reciente)
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }

        // Para el resto: El más nuevo arriba (Reciente -> Antiguo)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOrders(sorted);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    // Actualización optimista para que Hugo vea el cambio de color al instante
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado: newStatus } : o));

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Error al guardar en base de datos');
      fetchOrders(); // Revertimos si falla
    }
  };

  // ... (Funciones updateItemQuantity y finalizeOrder se mantienen igual)
  const updateItemQuantity = (orderId: number, itemIndex: number, newQty: number) => {
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const newDetails = [...order.detalle_pedido];
        newDetails[itemIndex].quantity = newQty;
        const newTotal = newDetails.reduce((sum: number, item: any) => sum + (item.precio_venta * item.quantity), 0);
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
        estado: 'Entregado' 
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

  if (loading) return <div className="p-10 text-center font-bold text-green-800">Cargando gestión de Amoree...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen pb-20">
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-green-100">
        <div>
          <h1 className="text-xl font-black text-green-900 uppercase">Gestión Amoree</h1>
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Prioridad: Pendientes más antiguos primero</p>
        </div>
        <button 
          onClick={fetchOrders} 
          disabled={refreshing}
          className="text-xs font-bold px-4 py-2 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
        >
          {refreshing ? '🔄 Ordenando...' : '🔄 Refrescar'}
        </button>
      </div>

      <div className="space-y-6">
        {orders.map(order => (
          <div key={order.id} className={`bg-white rounded-2xl p-5 shadow-md border-l-8 transition-all ${
            order.estado === 'Pendiente' ? 'border-yellow-400' : 
            order.estado === 'Pagado' ? 'border-blue-500' : 
            order.estado === 'Cancelado' ? 'border-red-400' : 'border-green-500'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block tracking-widest uppercase">ID: #{order.id} - {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span className="text-sm font-black text-gray-700 flex items-center gap-1">
                  📞 {order.telefono_cliente || 'Sin teléfono'}
                </span>
              </div>
              
              <select 
                value={order.estado || 'Pendiente'}
                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                className={`text-[10px] font-black py-1 px-3 rounded-full border-2 transition-colors cursor-pointer outline-none ${
                  order.estado === 'Pendiente' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                  order.estado === 'Entregado' ? 'bg-green-50 text-green-600 border-green-200' :
                  order.estado === 'Pagado' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                  'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                <option value="Pendiente">⏳ PENDIENTE</option>
                <option value="Entregado">🚚 ENTREGADO</option>
                <option value="Pagado">💰 PAGADO</option>
                <option value="Cancelado">❌ CANCELADO</option>
              </select>
            </div>

            <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {order.detalle_pedido?.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 font-bold text-gray-600">{item.nombre}</span>
                  <input 
                    type="number" step="0.001" value={item.quantity}
                    onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                    className="w-20 border border-gray-200 bg-white rounded py-1 text-center font-black text-green-700 focus:ring-2 focus:ring-green-400 outline-none"
                  />
                  <span className="text-gray-400 font-bold w-12">{item.unidad}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center pt-2">
              <span className="text-xl font-black text-gray-800 tracking-tighter">{formatCurrency(order.total)}</span>
              <button 
                onClick={() => finalizeOrder(order)}
                className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all"
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
