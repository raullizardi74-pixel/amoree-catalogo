import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients'>('orders');
  
  // NAVEGACIÓN DE ADN
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  
  // FILTROS TERMINAL
  const [filterMetodo, setFilterMetodo] = useState('Todos');
  const [filterTime, setFilterTime] = useState('Hoy');
  
  // FILTROS WHATSAPP
  const [statusFilterWA, setStatusFilterWA] = useState('Todos');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [metodoSeleccionado, setMetodoSeleccionado] = useState<Record<number, string>>({});

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // --- LÓGICA DE FILTRADO MAESTRA ---
  const getFilteredOrders = () => {
    let filtered = [...orders];

    // 1. Separación por tipo de ADN
    if (orderTab === 'whatsapp') {
      filtered = filtered.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO') && !o.telefono_cliente?.includes('LIQUIDACIÓN'));
      if (statusFilterWA !== 'Todos') filtered = filtered.filter(o => o.estado === statusFilterWA);
    } else if (orderTab === 'terminal') {
      filtered = filtered.filter(o => o.origen === 'Mostrador' && !o.telefono_cliente?.includes('ABONO') && !o.telefono_cliente?.includes('LIQUIDACIÓN'));
      // Filtros de Terminal
      if (filterMetodo !== 'Todos') filtered = filtered.filter(o => o.metodo_pago === filterMetodo);
      if (filterTime === 'Hoy') filtered = filtered.filter(o => isToday(new Date(o.created_at)));
      if (filterTime === 'Ayer') filtered = filtered.filter(o => isYesterday(new Date(o.created_at)));
      if (filterTime === '7d') filtered = filtered.filter(o => isAfter(new Date(o.created_at), subDays(new Date(), 7)));
    } else {
      filtered = filtered.filter(o => o.telefono_cliente?.includes('ABONO') || o.telefono_cliente?.includes('LIQUIDACIÓN'));
    }

    // 2. Buscador Global
    if (searchTerm) {
      filtered = filtered.filter(o => (o.nombre_cliente || o.telefono_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return filtered;
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
    const { error } = await supabase.from('pedidos').update({ 
        estado: 'Pendiente de Pago',
        detalle_pedido: orderToUpdate.detalle_pedido,
        total: orderToUpdate.total 
      }).eq('id', orderId);

    if (!error) {
      const telMatch = orderToUpdate.telefono_cliente.match(/(\d{10})/);
      if (telMatch) {
        const msg = `*AMOREE - Confirmación de Pesos* 🥑%0A%0A` +
                    orderToUpdate.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('%0A') +
                    `%0A%0A*TOTAL: ${formatCurrency(orderToUpdate.total)}*%0A%0AFavor de enviar comprobante. 🚀`;
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
          const msg = `*AMOREE - ¡Entregado!* 🥑%0A¡Muchas gracias por tu compra! 🚀`;
          window.open(`https://wa.me/52${tel}?text=${msg}`, '_blank');
        }
      }
      fetchOrders();
    }
  };

  if (loading && view === 'orders') return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.5em]">Sincronizando Radar...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-sans selection:bg-green-500/30">
      
      {/* NAVBAR MAESTRA */}
      <div className="bg-black/90 p-6 border-b border-white/5 flex justify-between items-center sticky top-0 z-[100] backdrop-blur-xl">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 border border-white/5">
          {[{ id: 'orders', label: 'Pedidos' }, { id: 'pos', label: 'Terminal' }, { id: 'clients', label: 'Cartera' }, { id: 'stats', label: 'Métricas' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${view === v.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'orders' ? (
          <>
            {/* SELECTOR DE PESTAÑAS ADN */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2">
                <button onClick={() => setOrderTab('whatsapp')} className={`px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'whatsapp' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'terminal' ? 'bg-white text-black shadow-lg' : 'text-gray-500'}`}>🏪 Terminal</button>
                <button onClick={() => setOrderTab('pagos')} className={`px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'pagos' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>🏦 Pagos</button>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {/* FILTROS DINÁMICOS POR PESTAÑA */}
                {orderTab === 'terminal' && (
                  <>
                    <select value={filterTime} onChange={(e) => setFilterTime(e.target.value)} className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-[9px] font-black uppercase text-green-500 outline-none">
                      {['Hoy', 'Ayer', '7d'].map(t => <option key={t} value={t} className="bg-black">{t}</option>)}
                    </select>
                    <select value={filterMetodo} onChange={(e) => setFilterMetodo(e.target.value)} className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-[9px] font-black uppercase text-gray-400 outline-none">
                      {['Todos', 'Efectivo', 'Tarjeta', 'Transferencia'].map(m => <option key={m} value={m} className="bg-black">{m}</option>)}
                    </select>
                  </>
                )}
                {orderTab === 'whatsapp' && (
                  <select value={statusFilterWA} onChange={(e) => setStatusFilterWA(e.target.value)} className="bg-green-600/10 border border-green-500/20 px-4 py-3 rounded-xl text-[9px] font-black uppercase text-green-500 outline-none">
                    {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
                  </select>
                )}
                <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[9px] font-black uppercase outline-none focus:border-green-500 w-40" />
              </div>
            </div>

            {/* VISTA WHATSAPP: TARJETAS CON URGENCIA */}
            {orderTab === 'whatsapp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {getFilteredOrders().map(order => {
                  const minutesOld = Math.floor((new Date().getTime() - new Date(order.created_at).getTime()) / 60000);
                  const isUrgent = order.estado === 'Pendiente' && minutesOld > 20;

                  return (
                    <div key={order.id} className={`bg-[#0A0A0A] border rounded-[50px] p-10 shadow-2xl transition-all relative ${isUrgent ? 'border-amber-500/50 shadow-amber-500/10 animate-pulse-subtle' : 'border-white/5'}`}>
                      {isUrgent && <span className="absolute -top-3 left-10 bg-amber-500 text-black text-[8px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-xl">⚠️ Demora: {minutesOld} min</span>}
                      
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <h3 className="text-2xl font-black tracking-tighter uppercase italic">{order.nombre_cliente || 'Invitado WA'}</h3>
                          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{order.telefono_cliente}</p>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${order.estado === 'Pendiente' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-green-500 text-green-500 bg-green-500/5'}`}>{order.estado}</span>
                      </div>

                      <div className="space-y-3 mb-10">
                        {order.detalle_pedido?.map((item: any) => (
                          <div key={item.sku} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                            <span className="text-[10px] font-black text-gray-400 uppercase">{item.nombre}</span>
                            {order.estado === 'Pendiente' ? (
                              <div className="flex items-center gap-3">
                                <input type="number" step="0.05" value={item.quantity} onChange={(e) => updateItemQuantity(order.id, item.sku, parseFloat(e.target.value))} className="w-20 bg-black border border-green-500/30 text-center rounded-xl py-2 text-xs font-black text-green-500" />
                                <span className="text-[8px] font-black text-gray-600 uppercase">{item.unidad || 'kg'}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-black text-white">{item.quantity}{item.unidad || 'kg'}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-end pt-8 border-t border-white/5">
                        <p className="text-4xl font-black text-white">{formatCurrency(order.total)}</p>
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          {order.estado === 'Pendiente' && <button onClick={() => handleConfirmWeights(order.id)} className="bg-green-600 text-white py-4 rounded-2xl text-[9px] font-black uppercase shadow-xl hover:scale-105 transition-all">⚖️ Confirmar Pesos</button>}
                          {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar', order)} className="bg-blue-600 text-white py-4 rounded-2xl text-[9px] font-black uppercase shadow-xl">💰 Liquidar</button>}
                          {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado', order)} className="bg-white text-black py-4 rounded-2xl text-[9px] font-black uppercase shadow-xl">📦 Entregado</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VISTA TERMINAL: ACORDEÓN ULTRA-COMPACTO */}
            {orderTab === 'terminal' && (
              <div className="bg-[#0A0A0A] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-6 p-6 border-b border-white/10 text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">
                  <span>ID</span>
                  <span>Hora</span>
                  <span className="text-left">Cliente</span>
                  <span>Método</span>
                  <span>Total</span>
                  <span>Acción</span>
                </div>
                <div className="divide-y divide-white/5">
                  {getFilteredOrders().map(order => (
                    <div key={order.id} className="transition-all hover:bg-white/[0.02]">
                      <div 
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        className="grid grid-cols-6 p-6 items-center cursor-pointer text-center"
                      >
                        <span className="text-[10px] font-black text-gray-600">#{order.id}</span>
                        <span className="text-[10px] font-black text-gray-400">{format(new Date(order.created_at), 'HH:mm')}</span>
                        <span className="text-[11px] font-black text-white text-left truncate uppercase italic">{order.nombre_cliente || 'Venta Local'}</span>
                        <span className="text-[9px] font-black text-green-500 uppercase">{order.metodo_pago || 'Efectivo'}</span>
                        <span className="text-lg font-black text-white">{formatCurrency(order.total)}</span>
                        <span className="text-xs">{expandedOrderId === order.id ? '🔼' : '🔽'}</span>
                      </div>
                      
                      {expandedOrderId === order.id && (
                        <div className="p-8 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2">
                          <div className="max-w-xl mx-auto space-y-2">
                            {order.detalle_pedido?.map((item: any) => (
                              <div key={item.sku} className="flex justify-between text-[10px] font-black uppercase border-b border-white/5 pb-2">
                                <span className="text-gray-400">{item.nombre}</span>
                                <span>{item.quantity} {item.unidad || 'kg'} x {formatCurrency(item.precio_venta || item['$ VENTA'])}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VISTA PAGOS: TARJETAS DNA AZUL */}
            {orderTab === 'pagos' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {getFilteredOrders().map(order => (
                  <div key={order.id} className="bg-[#0A0A0A] border border-blue-500/20 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500/50"></div>
                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.4em] mb-4">Registro Contable</p>
                    <h3 className="text-xl font-black uppercase italic mb-2 leading-none">{order.telefono_cliente?.split(':')[0]}</h3>
                    <p className="text-[9px] font-black text-gray-600 uppercase mb-6 tracking-widest">{order.telefono_cliente?.split(':')[1] || order.nombre_cliente}</p>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
                      <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Monto de Operación</p>
                      <p className="text-3xl font-black text-white">{formatCurrency(order.total)}</p>
                    </div>
                    <p className="text-[8px] font-black text-gray-700 uppercase">{format(new Date(order.created_at), 'dd MMM yyyy - HH:mm')}</p>
                  </div>
                ))}
              </div>
            )}

          </>
        ) : view === 'pos' ? <POS onBack={() => setView('orders')} /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </div>

      {/* FOOTER SWISS MADE */}
      <div className="fixed bottom-10 right-10 z-[100] hidden lg:block">
         <div className="bg-black/90 backdrop-blur-3xl border border-white/10 p-6 rounded-[40px] flex items-center gap-6 shadow-2xl">
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
