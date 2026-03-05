import { useEffect, useState } from 'react';
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
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (orderId: number, nextStatus: string, order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: nextStatus }).eq('id', orderId);
    
    if (!error) {
      if (nextStatus === 'Finalizado') {
        const tel = (order.telefono_cliente || "").match(/(\d{10})/)?.[1];
        if (tel) {
          const msg = `*AMOREE - Pedido Entregado* 🥑%0A%0A¡Hola, *${order.nombre_cliente || 'Cliente'}*! Tu pedido ha sido entregado exitosamente. Muchas gracias por tu preferencia. ¡Esperamos verte pronto! 🚀`;
          window.open(`https://wa.me/52${tel}?text=${msg}`, '_blank');
        }
      }
      fetchOrders();
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'Todos' || o.estado === statusFilter)
  );

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500">Sincronizando...</div>;

  return (
    <div className="min-h-screen bg-[#070707] text-white pb-32">
      {/* Header OS */}
      <div className="bg-black/90 p-6 border-b border-white/10 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-black uppercase tracking-tighter italic">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
          {['orders', 'pos', 'clients', 'stats'].map(v => (
            <button key={v} onClick={() => setView(v as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${view === v ? 'bg-white text-black' : 'text-gray-500'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {view === 'orders' ? (
          <>
            <div className="flex gap-4 mb-10">
              <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-white/5 border border-white/10 px-8 py-5 rounded-[2rem] text-sm" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-black border border-white/10 px-8 py-5 rounded-[2rem] text-sm font-black">
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredOrders.map(order => (
                <div key={order.id} className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">{order.origen}</p>
                      <h3 className="text-xl font-black">{order.nombre_cliente || 'Cliente Amoree'}</h3>
                      <p className="text-[10px] text-gray-500">{order.usuario_email}</p>
                    </div>
                    <span className="px-4 py-2 rounded-xl text-[8px] font-black uppercase border border-white/10">{order.estado}</span>
                  </div>
                  <div className="space-y-2 mb-8 border-y border-white/5 py-4">
                    {order.detalle_pedido?.map((item: any) => (
                      <div key={item.sku} className="flex justify-between text-xs font-bold text-gray-400">
                        <span>{item.quantity} {item.unidad || 'kg'} x {item.nombre}</span>
                        <span>{formatCurrency(item.precio_venta * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-3xl font-black">{formatCurrency(order.total)}</p>
                    <div className="flex gap-2">
                      {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago', order)} className="bg-amber-500 text-black px-6 py-3 rounded-2xl text-[9px] font-black uppercase">Surtir</button>}
                      {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar', order)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase">Cobrar</button>}
                      {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado', order)} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase">Entregado</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : view === 'pos' ? <POS onBack={() => setView('orders')} /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </div>
    </div>
  );
}
