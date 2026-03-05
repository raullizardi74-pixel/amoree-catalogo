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
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<Record<number, string>>({});

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateItemQuantity = (orderId: number, itemId: string, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = (order.detalle_pedido || []).map((item: any) => 
          item.sku === itemId ? { ...item, quantity: newQty } : item
        );
        const sub = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * item.precio_venta), 0);
        return { ...order, detalle_pedido: newDetails, total: sub + (sub > 0 && sub < 100 ? 30 : 0) };
      }
      return order;
    }));
  };

  const updateStatus = async (orderId: number, nextStatus: string, order: any) => {
    const payload: any = { estado: nextStatus };
    if (nextStatus === 'Pagado - Por Entregar') {
      payload.metodo_pago = metodoSeleccionado[orderId] || 'Efectivo';
    }

    const { error } = await supabase.from('pedidos').update(payload).eq('id', orderId);
    
    if (!error) {
      const tel = order.telefono_cliente.match(/(\d{10})/)?.[1];
      if (nextStatus === 'Pendiente de Pago' && tel) {
        // MENSAJE DE PESO REAL
        const msg = `*AMOREE - Confirmación de Pesos* 🥑%0A%0A¡Hola! Ya pesamos tu pedido en tienda:%0A` +
                    order.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}kg = *${formatCurrency(i.quantity * i.precio_venta)}*`).join('%0A') +
                    `%0A%0A*TOTAL FINAL: ${formatCurrency(order.total)}*%0A%0AFavor de enviar comprobante. ¡Gracias!`;
        window.open(`https://wa.me/52${tel}?text=${msg}`, '_blank');
      }
      if (nextStatus === 'Finalizado' && tel) {
        // MENSAJE DE GRACIAS
        const msg = `*AMOREE - ¡Entregado!* 🥑%0A%0A¡Muchas gracias por tu compra, *${order.nombre_cliente || 'Cliente'}*! Esperamos que disfrutes tus productos. ¡Nos vemos pronto! 🚀`;
        window.open(`https://wa.me/52${tel}?text=${msg}`, '_blank');
      }
      fetchOrders();
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-white pb-32">
      {/* HEADER TRADUCIDO Y LIMPIO */}
      <div className="bg-black/90 p-6 border-b border-white/10 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-xl font-black uppercase italic">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
          {[
            { id: 'orders', label: 'Pedidos' },
            { id: 'pos', label: 'Terminal' },
            { id: 'clients', label: 'Cartera' },
            { id: 'stats', label: 'Métricas' }
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${view === v.id ? 'bg-white text-black shadow-lg' : 'text-gray-500'}`}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row gap-4 mb-10">
              <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-white/5 border border-white/10 px-8 py-5 rounded-[2rem] text-sm" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-black border border-white/10 px-8 py-5 rounded-[2rem] text-sm font-black text-gray-400">
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {orders.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) && (statusFilter === 'Todos' || o.estado === statusFilter)).map(order => (
                <div key={order.id} className="bg-[#0A0A0A] border border-white/5 rounded-[45px] p-10 shadow-2xl relative">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter">{order.nombre_cliente || 'Cliente Amoree'}</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{order.telefono_cliente}</p>
                    </div>
                    <span className="px-5 py-2 rounded-2xl text-[9px] font-black uppercase border border-white/10 bg-white/5 text-gray-400">{order.estado}</span>
                  </div>

                  {/* AREA DE BÁSCULA: SOLO EN PENDIENTE */}
                  <div className="space-y-4 mb-8">
                    {order.estado === 'Pendiente' && (
                      <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-3xl mb-4">
                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest text-center">⚖️ Pesar artículos en báscula antes de confirmar</p>
                      </div>
                    )}
                    {order.detalle_pedido?.map((item: any) => (
                      <div key={item.sku} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                        <span className="text-xs font-bold text-gray-300">{item.nombre}</span>
                        {order.estado === 'Pendiente' ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" step="0.05" value={item.quantity} 
                              onChange={(e) => updateItemQuantity(order.id, item.sku, parseFloat(e.target.value))}
                              className="w-20 bg-black border border-white/10 text-center rounded-xl py-2 text-sm font-black text-green-500" 
                            />
                            <span className="text-[10px] font-black text-gray-600">KG</span>
                          </div>
                        ) : (
                          <span className="text-xs font-black">{item.quantity}kg - {formatCurrency(item.quantity * item.precio_venta)}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-8 border-t border-white/5">
                    <div>
                      <p className="text-[10px] font-black text-gray-600 uppercase mb-1">Total Final</p>
                      <p className="text-4xl font-black text-white">{formatCurrency(order.total)}</p>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago', order)} className="bg-green-600 text-white px-10 py-5 rounded-[25px] text-[10px] font-black uppercase shadow-lg shadow-green-600/20">⚖️ Confirmar Pesos</button>}
                      
                      {order.estado === 'Pendiente de Pago' && (
                        <div className="flex flex-col gap-2">
                          <select 
                            onChange={(e) => setMetodoSeleccionado({...metodoSeleccionado, [order.id]: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-xl p-2 text-[10px] font-black uppercase"
                          >
                            <option value="Efectivo" className="bg-black">Efectivo</option>
                            <option value="Transferencia" className="bg-black">Transferencia</option>
                            <option value="Terminal" className="bg-black">Terminal</option>
                          </select>
                          <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar', order)} className="bg-blue-600 text-white px-10 py-5 rounded-[25px] text-[10px] font-black uppercase shadow-lg shadow-blue-600/20">💰 Cobrar</button>
                        </div>
                      )}
                      
                      {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado', order)} className="bg-white text-black px-10 py-5 rounded-[25px] text-[10px] font-black uppercase shadow-lg">📦 Entregado</button>}
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
