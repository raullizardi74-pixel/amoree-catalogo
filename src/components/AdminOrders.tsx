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
  
  // SUB-PESTAÑAS DE PEDIDOS
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<Record<number, string>>({});

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // --- LÓGICA DE FILTRADO POR ADN ---
  const ordersWA = orders.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO') && !o.telefono_cliente?.includes('LIQUIDACIÓN'));
  const ordersPOS = orders.filter(o => o.origen === 'Mostrador' && !o.telefono_cliente?.includes('ABONO') && !o.telefono_cliente?.includes('LIQUIDACIÓN'));
  const ordersPagos = orders.filter(o => o.telefono_cliente?.includes('ABONO') || o.telefono_cliente?.includes('LIQUIDACIÓN'));

  const getFilteredOrders = () => {
    let target = orderTab === 'whatsapp' ? ordersWA : orderTab === 'terminal' ? ordersPOS : ordersPagos;
    return target.filter(o => (o.nombre_cliente || o.telefono_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
  };

  // --- FUNCIONES DE OPERACIÓN (SIN CAMBIOS) ---
  const updateItemQuantity = (orderId: number, itemSku: string, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = (order.detalle_pedido || []).map((item: any) => 
          (item.sku || item.SKU) === itemSku ? { ...item, quantity: newQty } : item
        );
        const sub = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * (item.precio_venta || item['$ VENTA'])), 0);
        const envio = (sub > 0 && sub < 100) ? 30 : 0;
        return { ...order, detalle_pedido: newDetails, total: sub + envio };
      }
      return order;
    }));
  };

  const handleConfirmWeights = async (orderId: number) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (!orderToUpdate) return;
    const nextStatus = 'Pendiente de Pago';
    const { error } = await supabase.from('pedidos').update({ 
        estado: nextStatus,
        detalle_pedido: orderToUpdate.detalle_pedido,
        total: orderToUpdate.total 
      }).eq('id', orderId);

    if (!error) {
      const telMatch = orderToUpdate.telefono_cliente.match(/(\d{10})/);
      if (telMatch) {
        const msg = `*AMOREE - Confirmación de Pesos* 🥑%0A%0A` +
                    `¡Hola! Ya pesamos tu pedido con el peso real:%0A` +
                    orderToUpdate.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('%0A') +
                    `%0A*TOTAL FINAL: ${formatCurrency(orderToUpdate.total)}*%0A%0AFavor de enviar comprobante. 🚀`;
        window.open(`https://wa.me/52${telMatch[1]}?text=${msg}`, '_blank');
      }
      fetchOrders();
    }
  };

  const updateStatus = async (orderId: number, nextStatus: string, order: any) => {
    const payload: any = { estado: nextStatus };
    if (nextStatus === 'Pagado - Por Entregar') {
      payload.metodo_pago = metodoSeleccionado[orderId] || 'Efectivo';
    }
    const { error } = await supabase.from('pedidos').update(payload).eq('id', orderId);
    if (!error) {
      if (nextStatus === 'Finalizado') {
        const tel = order.telefono_cliente.match(/(\d{10})/)?.[1];
        if (tel) {
          const msg = `*AMOREE - ¡Entregado!* 🥑%0A¡Muchas gracias, *${order.nombre_cliente || 'Cliente'}*! Tu pedido ha sido entregado exitosamente. 🚀`;
          window.open(`https://wa.me/52${tel}?text=${msg}`, '_blank');
        }
      }
      fetchOrders();
    }
  };

  if (loading && view === 'orders') return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.5em]">Titanium OS Radar...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-sans">
      {/* NAVBAR SUPERIOR */}
      <div className="bg-black/90 p-6 border-b border-white/5 flex justify-between items-center sticky top-0 z-[100] backdrop-blur-xl">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 border border-white/5">
          {[{ id: 'orders', label: 'Centro de Control' }, { id: 'pos', label: 'Terminal' }, { id: 'clients', label: 'Cartera' }, { id: 'stats', label: 'Métricas' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${view === v.id ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-white'}`}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-10">
        {view === 'orders' ? (
          <>
            {/* SUB-SELECTOR DE PESTAÑAS (DNA FILTERS) */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 md:flex-none px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${orderTab === 'whatsapp' ? 'bg-green-600 text-white shadow-[0_10px_20px_rgba(22,163,74,0.2)]' : 'text-gray-500 hover:bg-white/5'}`}>
                  <span>🛵</span> WhatsApp <span className="bg-black/20 px-2 py-0.5 rounded-full text-[8px]">{ordersWA.length}</span>
                </button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 md:flex-none px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500 hover:bg-white/5'}`}>
                  <span>🏪</span> Terminal <span className="bg-white/10 px-2 py-0.5 rounded-full text-[8px]">{ordersPOS.length}</span>
                </button>
                <button onClick={() => setOrderTab('pagos')} className={`flex-1 md:flex-none px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${orderTab === 'pagos' ? 'bg-blue-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)]' : 'text-gray-500 hover:bg-white/5'}`}>
                  <span>🏦</span> Pagos <span className="bg-black/20 px-2 py-0.5 rounded-full text-[8px]">{ordersPagos.length}</span>
                </button>
              </div>

              <div className="relative w-full md:w-80 group">
                <input type="text" placeholder="BUSCAR POR CLIENTE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/10 px-8 py-5 rounded-[2rem] text-[10px] font-black tracking-widest outline-none focus:border-green-500 transition-all uppercase" />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
              </div>
            </div>

            {/* GRID DE ÓRDENES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {getFilteredOrders().map(order => (
                <div key={order.id} className={`relative bg-[#0A0A0A] border rounded-[50px] p-10 shadow-2xl transition-all hover:scale-[1.01] ${
                  orderTab === 'whatsapp' ? 'border-green-500/10' : orderTab === 'terminal' ? 'border-white/5' : 'border-blue-500/20'
                }`}>
                  
                  {/* ADN DE TARJETA */}
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      {/* Lógica de Título Inteligente */}
                      <h3 className="text-2xl font-black tracking-tighter uppercase italic leading-none mb-2">
                        {order.telefono_cliente?.includes('ABONO') || order.telefono_cliente?.includes('LIQUIDACIÓN') 
                          ? order.telefono_cliente.split(':')[0] 
                          : (order.nombre_cliente || 'Cliente Amoree')}
                      </h3>
                      <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em]">
                        {order.telefono_cliente?.includes(':') ? order.telefono_cliente.split(':')[1] : order.telefono_cliente}
                      </p>
                    </div>
                    <span className={`px-5 py-2 rounded-2xl text-[8px] font-black uppercase tracking-widest border ${
                      order.estado === 'Pendiente' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                      order.estado === 'Finalizado' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                      'bg-white/5 border-white/10 text-gray-400'
                    }`}>
                      {order.estado}
                    </span>
                  </div>

                  {/* CUERPO DEL TICKET */}
                  <div className="space-y-3 mb-10">
                    {order.detalle_pedido?.length > 0 ? (
                      order.detalle_pedido.map((item: any) => (
                        <div key={item.sku || item.SKU} className="flex justify-between items-center bg-white/[0.02] p-5 rounded-[24px] border border-white/5">
                          <span className="text-[10px] font-black uppercase text-gray-400">{item.nombre}</span>
                          {order.estado === 'Pendiente' && orderTab === 'whatsapp' ? (
                            <div className="flex items-center gap-3">
                              <input 
                                type="number" step="0.05" value={item.quantity} 
                                onChange={(e) => updateItemQuantity(order.id, (item.sku || item.SKU), parseFloat(e.target.value))}
                                className="w-20 bg-black border border-green-500/30 text-center rounded-xl py-2 text-xs font-black text-green-500 outline-none" 
                              />
                              <span className="text-[8px] font-black text-gray-600 uppercase">{item.unidad || 'kg'}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-black text-white">{item.quantity}{item.unidad || 'kg'}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-[30px]">
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Transacción Contable Única</p>
                      </div>
                    )}
                  </div>

                  {/* PIE DE TARJETA (TOTAL Y ACCIONES) */}
                  <div className="flex justify-between items-end pt-8 border-t border-white/5">
                    <div>
                      <p className="text-[8px] font-black text-gray-600 uppercase mb-2 tracking-widest">Total Transacción</p>
                      <p className={`text-4xl font-black tracking-tighter ${orderTab === 'pagos' ? 'text-blue-500' : 'text-white'}`}>
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[180px]">
                      {order.estado === 'Pendiente' && orderTab === 'whatsapp' && (
                        <button onClick={() => handleConfirmWeights(order.id)} className="bg-green-600 text-white py-5 rounded-[22px] text-[10px] font-black uppercase shadow-[0_10px_30px_rgba(22,163,74,0.3)] hover:scale-105 transition-all">⚖️ Surtir y Notificar</button>
                      )}
                      
                      {order.estado === 'Pendiente de Pago' && (
                        <div className="flex flex-col gap-2">
                          <select 
                            onChange={(e) => setMetodoSeleccionado({...metodoSeleccionado, [order.id]: e.target.value})}
                            className="bg-white/5 border border-white/10 rounded-xl p-3 text-[9px] font-black uppercase text-center outline-none"
                          >
                            <option value="Efectivo" className="bg-black">Efectivo</option>
                            <option value="Transferencia" className="bg-black">Transferencia</option>
                            <option value="Terminal" className="bg-black">Terminal</option>
                          </select>
                          <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar', order)} className="bg-blue-600 text-white py-4 rounded-[22px] text-[10px] font-black uppercase shadow-lg shadow-blue-600/20">💰 Liquidar</button>
                        </div>
                      )}
                      
                      {order.estado === 'Pagado - Por Entregar' && (
                        <button onClick={() => updateStatus(order.id, 'Finalizado', order)} className="bg-white text-black py-5 rounded-[22px] text-[10px] font-black uppercase shadow-xl hover:bg-green-500 hover:text-white transition-all">📦 Confirmar Entrega</button>
                      )}

                      {order.estado === 'Finalizado' && (
                        <div className="text-center opacity-30">
                          <p className="text-[8px] font-black uppercase tracking-widest">✅ Registro Cerrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ESTADO VACÍO */}
            {getFilteredOrders().length === 0 && (
              <div className="text-center py-40 border-2 border-dashed border-white/5 rounded-[60px]">
                <p className="text-gray-600 font-black uppercase text-xs tracking-[0.5em]">No hay actividad en esta pestaña</p>
              </div>
            )}
          </>
        ) : view === 'pos' ? <POS onBack={() => setView('orders')} /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </div>

      {/* FOOTER SWISS MADE */}
      <div className="fixed bottom-10 right-10 z-[100] hidden lg:block">
         <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-6 rounded-[40px] flex items-center gap-6 shadow-2xl">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-green-600/20">🛡️</div>
            <div>
               <p className="text-[10px] font-black text-white uppercase tracking-tighter mb-1 leading-none">Amoree Titanium OS</p>
               <p className="text-[7px] font-bold text-green-500/50 uppercase tracking-[0.4em]">Audit Mode Active</p>
            </div>
         </div>
      </div>
    </div>
  );
}
