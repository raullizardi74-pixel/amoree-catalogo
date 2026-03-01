import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard'; // Importación del componente de reportes

export default function AdminOrders() {
  // --- ESTADOS ---
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // PASO 2: El "Switch" para cambiar entre vista de Pedidos y Estadísticas
  const [view, setView] = useState<'orders' | 'stats'>('orders');

  // --- LÓGICA DE CARGA DE DATOS ---
  const fetchOrders = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*');

    if (error) {
      console.error('Error:', error);
    } else if (data) {
      // Ordenamiento personalizado: Pendientes primero, luego Entregados, etc.
      const statusWeight: Record<string, number> = {
        'Pendiente': 1,
        'Entregado': 2,
        'Pagado': 3,
        'Cancelado': 4
      };

      const sorted = data.sort((a, b) => {
        const weightA = statusWeight[a.estado] || 5;
        const weightB = statusWeight[b.estado] || 5;

        if (weightA !== weightB) {
          return weightA - weightB;
        }

        // Si son del mismo estado (ej. Pendientes), el más viejo arriba
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setOrders(sorted);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // --- FUNCIONES DE GESTIÓN ---
  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ estado: newStatus })
      .eq('id', orderId);

    if (!error) fetchOrders();
  };

  const updateItemQuantity = (orderId: number, itemIdx: number, newQuantity: number) => {
    setOrders(prevOrders => prevOrders.map(order => {
      if (order.id === orderId) {
        const newDetails = [...order.detalle_pedido];
        newDetails[itemIdx] = { ...newDetails[itemIdx], quantity: newQuantity };
        
        // Recalcular total del pedido
        const newTotal = newDetails.reduce((sum, item) => {
          return sum + (item.precio_venta * item.quantity);
        }, 0);

        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    }));
  };

  const finalizeOrder = async (order: any) => {
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        estado: 'Pagado',
        detalle_pedido: order.detalle_pedido,
        total: order.total
      })
      .eq('id', order.id);

    if (!error) fetchOrders();
  };

  // --- FILTRADO DE BÚSQUEDA ---
  const filteredOrders = orders.filter(order => 
    order.telefono_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toString().includes(searchTerm)
  );

  if (loading) return <div className="p-10 text-center font-bold text-green-700 animate-pulse">CARGANDO PEDIDOS...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter italic uppercase">
            Panel <span className="text-green-600">Admin</span>
          </h1>

          {/* PASO 3: Selector de Vista (Pedidos vs Estadísticas) */}
          <div className="flex bg-gray-200 p-1 rounded-2xl shadow-inner">
            <button
              onClick={() => setView('orders')}
              className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                view === 'orders' 
                ? 'bg-white text-green-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📦 Pedidos
            </button>
            <button
              onClick={() => setView('stats')}
              className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                view === 'stats' 
                ? 'bg-green-600 text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 Estadísticas
            </button>
          </div>
        </div>

        {/* PASO 4: Renderizado Condicional */}
        {view === 'orders' ? (
          <>
            {/* Buscador de Pedidos */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="🔍 Buscar por teléfono o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border-2 border-gray-100 rounded-2xl py-3 px-6 text-sm font-bold shadow-sm focus:ring-4 focus:ring-green-100 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                  {/* Cabecera del Pedido */}
                  <div className={`p-4 ${
                    order.estado === 'Pendiente' ? 'bg-orange-50 border-b border-orange-100' :
                    order.estado === 'Pagado' ? 'bg-green-50 border-b border-green-100' : 'bg-gray-50 border-b'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">ID: #{order.id}</span>
                      <select 
                        value={order.estado}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className="text-[10px] font-bold uppercase bg-white border rounded-lg px-2 py-1 outline-none"
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Entregado">Entregado</option>
                        <option value="Pagado">Pagado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>
                    <p className="font-black text-gray-800">{order.telefono_cliente}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{new Date(order.created_at).toLocaleString()}</p>
                  </div>

                  {/* Detalle de Productos (Editables para peso real) */}
                  <div className="p-4 flex-1 space-y-3">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Productos:</p>
                    <div className="space-y-2">
                      {order.detalle_pedido?.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                          <span className="flex-1 font-bold text-[11px] text-gray-700 leading-tight">{item.nombre}</span>
                          <input 
                            type="number" 
                            step="0.001" 
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                            className="w-16 border-2 border-green-200 bg-white rounded-lg py-1 text-center font-black text-green-700 text-xs focus:ring-2 focus:ring-green-400 outline-none"
                          />
                          <span className="text-[9px] font-black text-gray-400 w-8 uppercase">{item.unidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Acciones Finales */}
                  <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-gray-400 uppercase">Total:</span>
                      <span className="text-xl font-black text-gray-900">{formatCurrency(order.total)}</span>
                    </div>
                    {order.estado !== 'Pagado' && (
                      <button 
                        onClick={() => finalizeOrder(order)}
                        className="w-full bg-green-600 text-white py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 transition-all"
                      >
                        Finalizar y Cobrar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Dashboard /> // Muestra el componente de estadísticas
        )}
      </div>
    </div>
  );
}
