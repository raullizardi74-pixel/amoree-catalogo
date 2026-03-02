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

  const itemFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(order => {
      (order.detalle_pedido || []).forEach((item: any) => {
        counts[item.nombre] = (counts[item.nombre] || 0) + 1;
      });
    });
    return counts;
  }, [orders]);

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

  if (view === 'pos') return <POS onBack={() => { setView('orders'); fetchOrders(); }} />;

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen pb-32">
      <div className="max-w-6xl mx-auto">
        
        {/* NAVEGACIÓN */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Amoree <span className="text-green-600">Admin</span></h1>
          <div className="flex bg-white p-1.5 rounded-2xl shadow-md border border-gray-200">
            <button onClick={() => setView('orders')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase ${view === 'orders' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>📦 Logística</button>
            <button onClick={() => setView('stats')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase ${view === 'stats' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>📊 Negocio</button>
            <button onClick={() => setView('clients')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase ${view === 'clients' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>👥 Clientes</button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            <button onClick={() => setView('pos')} className="w-full bg-blue-600 text-white p-6 rounded-[2.5rem] shadow-xl shadow-blue-100 flex items-center justify-center gap-4 mb-10 active:scale-95 transition-all">
              <span className="text-3xl">⚡</span>
              <p className="text-xl font-black uppercase italic">Venta en Mostrador (TPV)</p>
            </button>

            <div className="bg-white p-5 rounded-3xl shadow-sm mb-10 space-y-4">
              <input type="text" placeholder="🔍 Buscar por nombre o celular..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-0 font-bold outline-none" />
              <div className="flex flex-wrap gap-2">
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(status => (
                  <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${statusFilter === status ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>{status}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredOrders.map((order) => (
                <div key={order.id} className={`rounded-[2.5rem] shadow-xl border-2 flex flex-col overflow-hidden transition-all ${order.estado === 'Pendiente' ? 'bg-orange-50 border-orange-200' : order.estado === 'Pendiente de Pago' ? 'bg-blue-50 border-blue-200' : order.estado === 'Pagado - Por Entregar' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                  <div className="p-5 border-b border-black/5 flex justify-between items-center bg-white/40">
                    <p className="font-black text-gray-800 text-sm">{order.telefono_cliente}</p>
                    <span className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-full ${order.estado === 'Finalizado' ? 'bg-gray-200 text-gray-400' : 'bg-white text-gray-900 shadow-sm'}`}>{order.estado}</span>
                  </div>

                  <div className="p-6 flex-1 space-y-2">
                    {(order.detalle_pedido || []).length > 0 ? (
                      [...order.detalle_pedido].sort((a,b) => (itemFrequency[b.nombre] || 0) - (itemFrequency[a.nombre] || 0)).map((item, idx) => {
                        const originalIdx = order.detalle_pedido.findIndex((i: any) => i.nombre === item.nombre);
                        return (
                          <div key={idx} className="flex justify-between items-center text-[11px] font-bold bg-white/60 p-3 rounded-xl border border-black/5">
                            <span className="uppercase tracking-tighter">{item.nombre}</span>
                            <input type="number" step="0.001" value={item.quantity} onChange={e => updateItemQuantity(order.id, originalIdx, parseFloat(e.target.value))} className="w-16 font-black text-xs text-green-700 text-center bg-white border-2 border-green-100 rounded-lg py-1 outline-none" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4 uppercase text-[10px] font-black text-blue-600 tracking-widest">
                         ✨ Movimiento de Saldo / Abono
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-black/5 flex justify-between items-end">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black opacity-30 uppercase">{order.metodo_pago || 'Efectivo'}</span>
                      {order.metodo_pago === 'A Cuenta' && order.estado !== 'Finalizado' && (
                        <div className="bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase animate-pulse">Deuda Activa</div>
                      )}
                    </div>
                    <p className="text-2xl font-black tracking-tighter">{formatCurrency(order.total)}</p>
                  </div>
                  
                  {/* BOTONES DE ACCIÓN RÁPIDA */}
                  <div className="px-6 pb-6 bg-black/5">
                    {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">🚀 Confirmar Pesos</button>}
                    {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">💰 Recibir Pago</button>}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado')} className="w-full bg-gray-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">📦 Marcar Entregado</button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : view === 'stats' ? <Dashboard /> : <ClientsModule />}

        {/* SELLO DE GARANTÍA */}
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
                 <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-1">Certificado</p>
                 <p className="text-[10px] font-black text-gray-900">2026</p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
