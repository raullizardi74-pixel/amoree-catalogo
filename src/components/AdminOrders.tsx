import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS'; // Importamos la nueva Terminal

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Añadimos 'pos' a los estados de vista
  const [view, setView] = useState<'orders' | 'stats' | 'pos'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

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

  const sendDigitalTicket = async (order: any) => {
    const rawPhone = order.telefono_cliente.split(' ')[0].replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;
    const datosBancarios = { banco: "BBVA / BANCOPPEL", nombre: "HUGO [APELLIDO]", clabe: "0123 4567 8901 2345 67", tarjeta: "4152 0000 0000 0000" };

    let ticket = `*TICKET DIGITAL - AMOREE* ✅\n_Pedido pesado y listo_\n--------------------------\n`;
    order.detalle_pedido.forEach((item: any) => {
      ticket += `• ${item.quantity.toFixed(3)} ${item.unidad} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
    });
    ticket += `--------------------------\n💰 *TOTAL: ${formatCurrency(order.total)}*\n\n`;
    ticket += `*PAGO:* 🏦\n• *Banco:* ${datosBancarios.banco}\n• *CLABE:* \`${datosBancarios.clabe}\`\n\n_Favor de enviar comprobante._ 🥑`;

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

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.telefono_cliente?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || o.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // SI LA VISTA ES POS, MOSTRAR TERMINAL A PANTALLA COMPLETA
  if (view === 'pos') return <POS onBack={() => { setView('orders'); fetchOrders(); }} />;

  if (loading) return <div className="p-10 text-center font-black text-green-700 animate-pulse uppercase tracking-widest">Sincronizando...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        
        {/* ENCABEZADO Y SELECTOR DE VISTA */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900">Amoree <span className="text-green-600">Admin</span></h1>
          <div className="flex bg-white p-1.5 rounded-2xl shadow-md border border-gray-200">
            <button onClick={() => setView('orders')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'orders' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>📦 Logística</button>
            <button onClick={() => setView('stats')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'stats' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>📊 Negocio</button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            {/* BOTÓN DE VENTA LOCAL (LA CLAVE DEL NEGOCIO) */}
            <div className="mb-8">
              <button 
                onClick={() => setView('pos')}
                className="w-full bg-blue-600 text-white p-6 rounded-[2.5rem] shadow-xl shadow-blue-100 flex items-center justify-center gap-4 hover:bg-blue-700 transition-all active:scale-95 group"
              >
                <span className="text-3xl group-hover:rotate-12 transition-transform">⚡</span>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 leading-none mb-1">Nueva Operación</p>
                  <p className="text-xl font-black uppercase italic leading-none">Venta en Mostrador (TPV)</p>
                </div>
              </button>
            </div>

            {/* FILTROS */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-200 mb-8 space-y-4">
              <input 
                type="text" placeholder="🔍 Buscar teléfono o ID..." value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full px-6 py-3 rounded-2xl bg-gray-50 border-0 font-bold outline-none focus:ring-4 focus:ring-green-100"
              />
              <div className="flex flex-wrap gap-2">
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(status => (
                  <button
                    key={status} onClick={() => setStatusFilter(status)}
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* LISTADO DE TARJETAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className={`rounded-[2.5rem] shadow-xl border-2 flex flex-col overflow-hidden ${order.estado === 'Pendiente' ? 'bg-orange-50 border-orange-200' : order.estado === 'Pendiente de Pago' ? 'bg-blue-50 border-blue-200' : order.estado === 'Pagado - Por Entregar' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                  <div className="p-5 border-b border-black/5 flex justify-between items-center">
                    <p className="font-black text-gray-800 text-sm">{order.telefono_cliente}</p>
                    <select 
                      value={order.estado}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border-0 ${order.estado === 'Pendiente' ? 'bg-orange-500 text-white' : order.estado === 'Pendiente de Pago' ? 'bg-blue-600 text-white' : order.estado === 'Pagado - Por Entregar' ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Pendiente de Pago">Pendiente de Pago</option>
                      <option value="Pagado - Por Entregar">Pagado - Por Entregar</option>
                      <option value="Finalizado">Finalizado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div className="p-5 flex-1 space-y-2 max-h-56 overflow-y-auto">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 bg-white/50 p-3 rounded-2xl border border-black/5">
                        <span className="flex-1 text-[11px] font-black uppercase tracking-tighter">{item.nombre}</span>
                        <input type="number" step="0.001" value={item.quantity} onChange={e => updateItemQuantity(order.id, idx, parseFloat(e.target.value))} className="w-16 font-black text-xs text-green-700 text-center bg-white border-2 border-green-100 rounded-lg py-1" />
                      </div>
                    ))}
                  </div>

                  <div className="p-5 bg-black/5 mt-auto">
                    <p className="text-right text-2xl font-black text-gray-900 tracking-tighter mb-4">{formatCurrency(order.total)}</p>
                    {order.estado === 'Pendiente' && <button onClick={() => sendDigitalTicket(order)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">🚀 Enviar Ticket</button>}
                    {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">💰 Recibir Pago</button>}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado')} className="w-full bg-gray-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">📦 Entregado</button>}
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
