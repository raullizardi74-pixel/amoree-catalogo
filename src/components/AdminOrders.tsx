import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats'>('orders');
  
  // FILTROS
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
      const sorted = data.sort((a, b) => (statusWeight[a.estado] || 6) - (statusWeight[b.estado] || 6));
      setOrders(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // --- LÓGICA DE ACTUALIZACIÓN ---
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

  // --- FILTRADO INTELIGENTE ---
  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.telefono_cliente?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || o.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-10 text-center font-black text-green-700 animate-pulse uppercase tracking-widest">Sincronizando...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        
        {/* ENCABEZADO Y SELECTOR DE VISTA */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900">
            Amoree <span className="text-green-600">Admin</span>
          </h1>
          <div className="flex bg-white p-1 rounded-2xl shadow-md border border-gray-200">
            <button onClick={() => setView('orders')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'orders' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>📦 Logística</button>
            <button onClick={() => setView('stats')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'stats' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>📊 Negocio</button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            {/* PANEL DE FILTROS */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-200 mb-8 space-y-4">
              <div className="relative">
                <input 
                  type="text" placeholder="🔍 Buscar por celular o ID..." value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-50 border-0 font-bold focus:ring-4 focus:ring-green-100 transition-all outline-none"
                />
                <span className="absolute left-4 top-3.5 opacity-30 text-xl">🔍</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                      statusFilter === status 
                      ? 'bg-gray-800 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* LISTADO DE TARJETAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div 
                  key={order.id} 
                  className={`rounded-[2.5rem] shadow-xl border-2 transition-all overflow-hidden flex flex-col ${
                    order.estado === 'Pendiente' ? 'bg-orange-50 border-orange-200' : 
                    order.estado === 'Pendiente de Pago' ? 'bg-blue-50 border-blue-200' : 
                    order.estado === 'Pagado - Por Entregar' ? 'bg-green-50 border-green-200' : 
                    'bg-white border-gray-100 opacity-80'
                  }`}
                >
                  {/* CABECERA CON SELECTOR DE ESTADO (SEGURIDAD) */}
                  <div className="p-5 border-b border-black/5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Orden #{order.id}</span>
                      <select 
                        value={order.estado}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border-0 shadow-sm cursor-pointer outline-none ${
                          order.estado === 'Pendiente' ? 'bg-orange-500 text-white' : 
                          order.estado === 'Pendiente de Pago' ? 'bg-blue-600 text-white' : 
                          order.estado === 'Pagado - Por Entregar' ? 'bg-green-600 text-white' : 
                          'bg-gray-400 text-white'
                        }`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Pendiente de Pago">Pendiente de Pago</option>
                        <option value="Pagado - Por Entregar">Pagado - Por Entregar</option>
                        <option value="Finalizado">Finalizado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>
                    <p className="font-black text-gray-800 text-lg leading-none tracking-tighter">{order.telefono_cliente}</p>
                  </div>

                  {/* AJUSTE DE GRAMAJE */}
                  <div className="p-5 flex-1 space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-black/5 shadow-sm">
                        <span className="flex-1 text-[11px] font-black text-gray-700 leading-tight uppercase tracking-tighter">{item.nombre}</span>
                        <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-green-100 px-2 py-1">
                           <input 
                            type="number" step="0.001" value={item.quantity}
                            onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                            className="w-16 font-black text-xs text-green-700 text-center outline-none bg-transparent"
                          />
                          <span className="text-[8px] font-black text-gray-400 uppercase">{item.unidad}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ACCIONES RÁPIDAS */}
                  <div className="p-5 bg-black/5 mt-auto">
                    <div className="flex justify-between items-end mb-4">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Real</p>
                      <p className="text-2xl font-black text-gray-900 tracking-tighter">{formatCurrency(order.total)}</p>
                    </div>

                    {order.estado === 'Pendiente' && (
                      <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">🚀 Enviar Ticket</button>
                    )}

                    {order.estado === 'Pendiente de Pago' && (
                      <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">💰 Recibir Pago</button>
                    )}

                    {order.estado === 'Pagado - Por Entregar' && (
                      <button onClick={() => updateStatus(order.id, 'Finalizado')} className="w-full bg-gray-800 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">📦 Entregado</button>
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
