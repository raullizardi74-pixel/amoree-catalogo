import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  const fetchOrders = async () => {
    const { data } = await supabase.from('pedidos').select('*');
    if (data) {
      const statusWeight: Record<string, number> = {
        'Pendiente': 1, 'Pendiente de Pago': 2, 'Pagado - Por Entregar': 3, 'Finalizado': 4, 'Cancelado': 5
      };
      const sorted = data.sort((a, b) => {
        const weightA = statusWeight[a.estado] || 6;
        const weightB = statusWeight[b.estado] || 6;
        if (weightA !== weightB) return weightA - weightB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setOrders(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (orderId: number, nextStatus: string) => {
    const pedidoActual = orders.find(o => o.id === orderId);
    
    // Disparador de WhatsApp cuando se confirman pesos
    if (nextStatus === 'Pendiente de Pago' && pedidoActual) {
      // Extracción de datos del string "Tel : Nombre : Hora"
      const partes = pedidoActual.telefono_cliente.split(':');
      const telefonoOriginal = partes[0]?.trim() || '';
      const nombreCliente = partes[1]?.trim() || 'Cliente';
      const horaSucia = partes[2]?.trim() || 'Lo antes posible';

      // Formateador de hora robusto (24h -> 12h AM/PM)
      const formatHora = (hRaw: string) => {
        if (!hRaw.includes(':')) return hRaw;
        try {
          const [h, m] = hRaw.split(':');
          let horas = parseInt(h);
          const ampm = horas >= 12 ? 'PM' : 'AM';
          horas = horas % 12 || 12;
          return `${horas}:${m.padStart(2, '0')} ${ampm}`;
        } catch { return hRaw; }
      };

      const horaFinal = formatHora(horaSucia);
      const numWhatsApp = pedidoActual.whatsapp_contacto || telefonoOriginal;

      // Estructura de cobro profesional
      const datosBancarios = `%0A🏦 *DATOS DE PAGO:*%0A*Banco:* BBVA%0A*Titular:* Hugo Macario López%0A*CLABE:* 012 650 0152436789 0%0A*Concepto:* ${nombreCliente}`;

      const mensaje = `*AMOREE - Confirmación de Pedido* 🥑%0A%0A` +
        `Hola ${nombreCliente}, ya pesamos tus productos en tienda:%0A` +
        `--------------------------%0A` +
        pedidoActual.detalle_pedido.map((item: any) => 
          `- ${item.nombre}: ${item.quantity}kg x $${item.precio_venta} = *${formatCurrency(item.quantity * item.precio_venta)}*`
        ).join('%0A') +
        `%0A--------------------------%0A` +
        `*TOTAL FINAL: ${formatCurrency(pedidoActual.total)}*%0A` +
        `🚚 *HORARIO DE ENTREGA:* ${horaFinal}%0A` +
        `--------------------------%0A` +
        datosBancarios + `%0A%0A` +
        `*Favor de enviar comprobante por este medio.* ¡Gracias! 🚀`;

      window.open(`https://wa.me/${numWhatsApp.replace(/\D/g, '')}?text=${mensaje}`, '_blank');
    }

    // Actualización en Base de Datos con persistencia de pesos ajustados
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        estado: nextStatus,
        total: pedidoActual?.total,
        detalle_pedido: pedidoActual?.detalle_pedido
      })
      .eq('id', orderId);

    if (!error) fetchOrders();
  };

  const updateItemQuantity = (orderId: number, itemId: string, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = order.detalle_pedido.map((item: any) => 
          item.id === itemId ? { ...item, quantity: newQty } : item
        );
        const newTotal = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * item.precio_venta), 0);
        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    }));
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.telefono_cliente.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || order.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8"><div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-32">
      {/* HEADER DINÁMICO */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-green-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg">🥑</div>
          <h1 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Amoree <span className="text-green-600">OS</span></h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
          <button onClick={() => setView('orders')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'orders' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Pedidos</button>
          <button onClick={() => setView('pos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'pos' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>TPV</button>
          <button onClick={() => setView('clients')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'clients' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Cartera</button>
          <button onClick={() => setView('stats')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'stats' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Stats</button>
        </div>
      </div>

      {view === 'pos' ? <POS /> : view === 'orders' ? (
        <>
          {/* FILTROS DE BÚSQUEDA */}
          <div className="p-6 max-w-5xl mx-auto flex flex-col md:flex-row gap-4">
            <input type="text" placeholder="Buscar por cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-white border border-gray-200 px-6 py-4 rounded-3xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600/20 transition-all shadow-sm" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-gray-200 px-6 py-4 rounded-3xl text-sm font-bold text-gray-700 shadow-sm">
              <option>Todos</option>
              <option>Pendiente</option>
              <option>Pendiente de Pago</option>
              <option>Pagado - Por Entregar</option>
              <option>Finalizado</option>
              <option>Cancelado</option>
            </select>
          </div>

          {/* GRID DE PEDIDOS */}
          <div className="px-6 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-[40px] p-8 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Cliente</p>
                    <h3 className="text-lg font-black text-gray-900 leading-tight">{order.telefono_cliente.split(':')[1] || 'Sin Nombre'}</h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">{order.telefono_cliente.split(':')[0]}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                    order.estado === 'Pendiente' ? 'bg-amber-100 text-amber-600' :
                    order.estado === 'Pendiente de Pago' ? 'bg-blue-100 text-blue-600' :
                    order.estado === 'Pagado - Por Entregar' ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>{order.estado}</span>
                </div>

                <div className="space-y-4 mb-8">
                  {order.detalle_pedido.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl border border-gray-100">
                      <span className="text-sm font-bold text-gray-800">{item.nombre}</span>
                      <div className="flex items-center gap-3">
                        <input type="number" value={item.quantity} onChange={(e) => updateItemQuantity(order.id, item.id, parseFloat(e.target.value))} className="w-16 bg-white border border-gray-200 text-center rounded-xl py-1 text-sm font-black focus:outline-none focus:ring-2 focus:ring-green-600/20" step="0.05" />
                        <span className="text-xs font-bold text-gray-400">kg</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Final</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(order.total)}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-600/20 hover:scale-105 transition-all">⚖️ Confirmar Pesos</button>}
                    {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:scale-105 transition-all">💰 Marcar Pagado</button>}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado')} className="bg-gray-800 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all">📦 Entregado</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : view === 'stats' ? <Dashboard /> : <ClientsModule />}

      {/* SELLO DE GARANTÍA AUTOMATIZA CON RAUL */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
         <div className="bg-white/90 backdrop-blur-xl border border-gray-200 p-4 rounded-3xl flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
               <div className="bg-green-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg">🚀</div>
               <div>
                  <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Socio Tecnológico Amoree</p>
               </div>
            </div>
            <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
            <div className="text-right">
               <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-1">Swiss Made</p>
               <p className="text-[10px] font-bold text-gray-900 leading-none">V2.0</p>
            </div>
         </div>
      </div>
    </div>
  );
}
