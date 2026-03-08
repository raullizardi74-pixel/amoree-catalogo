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
  
  // FILTROS
  const [filterMetodo, setFilterMetodo] = useState('Todos');
  const [filterTime, setFilterTime] = useState('Hoy');
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

  // --- 🚀 MOTOR DE TICKET DIGITAL INTELIGENTE ---
  const enviarTicketDigitalWA = async (order: any) => {
    // 1. Intentamos obtener datos existentes
    let telefono = order.telefono_cliente?.match(/(\d{10})/)?.[1];
    let nombre = order.nombre_cliente || 'Cliente';
    const metodo = order.metodo_pago || 'Efectivo';

    // 2. Solo preguntamos datos si es Venta Local/Anónima y no tiene teléfono
    if ((!order.nombre_cliente || order.nombre_cliente === 'Venta Local') && !telefono) {
      const inputNombre = prompt("👤 Nombre del Cliente (Opcional):");
      
      // Si cancela el nombre, respetamos y preguntamos solo el número
      if (inputNombre === null) {
        const soloTel = prompt("📱 WhatsApp para enviar ticket (10 dígitos):");
        if (soloTel && soloTel.length === 10) telefono = soloTel;
        else return;
      } else {
        const inputTel = prompt("📱 WhatsApp del Cliente (10 dígitos):");
        if (inputNombre && inputTel && inputTel.length === 10) {
          nombre = inputNombre.toUpperCase();
          telefono = inputTel;
          // Guardamos en DB para que ya no sea anónimo
          try {
            await supabase.from('clientes').insert([{ nombre, telefono, saldo_deudor: 0 }]);
            await supabase.from('pedidos').update({ nombre_cliente: nombre, telefono_cliente: telefono }).eq('id', order.id);
            fetchOrders();
          } catch (e) { console.error("Error al registrar socio", e); }
        } else {
          return;
        }
      }
    }

    // 3. Preparación de datos del ticket
    const fecha = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm');
    const items = order.detalle_pedido?.map((i: any) => 
      `• ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`
    ).join('\n');

    // 4. Mensaje personalizado según Método de Pago
    let mensajeCierre = "";
    switch (metodo) {
      case 'Efectivo':
        mensajeCierre = `✅ *Pago en Efectivo recibido.* \n¡Gracias por tu compra directa en tienda!`;
        break;
      case 'Transferencia':
        mensajeCierre = `🏦 *Pago por Transferencia confirmado.* \nEl comprobante ha sido validado en sistema.`;
        break;
      case 'Terminal':
        mensajeCierre = `💳 *Pago con Tarjeta aprobado.* \nTransacción procesada exitosamente.`;
        break;
      case 'A Cuenta':
        mensajeCierre = `📑 *Venta registrada A CUENTA.* \nTu saldo ha sido actualizado en cartera.`;
        break;
      default:
        mensajeCierre = `¡Gracias por tu preferencia!`;
    }

    // 5. Construcción Final con encodeURIComponent para evitar cortes
    const mensajeFull = `*AMOREE - Recibo Digital* 🥑\n` +
                        `--------------------------\n` +
                        `¡Hola *${nombre}*!\n` +
                        `*Folio:* #${order.id}\n` +
                        `*Fecha:* ${fecha}\n` +
                        `--------------------------\n` +
                        `${items}\n` +
                        `--------------------------\n` +
                        `*TOTAL: ${formatCurrency(order.total)}*\n\n` +
                        `${mensajeCierre}\n` +
                        `--------------------------\n` +
                        `🚀 *Amoree Titanium OS* - Eco Ticket`;

    window.open(`https://wa.me/52${telefono}?text=${encodeURIComponent(mensajeFull)}`, '_blank');
  };

  // --- LÓGICA DE FILTRADO ---
  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') {
      filtered = filtered.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO') && !o.telefono_cliente?.includes('LIQUIDACIÓN'));
      if (statusFilterWA !== 'Todos') filtered = filtered.filter(o => o.estado === statusFilterWA);
    } else if (orderTab === 'terminal') {
      filtered = filtered.filter(o => o.origen === 'Mostrador' && !o.telefono_cliente?.includes('ABONO') && !o.telefono_cliente?.includes('LIQUIDACIÓN'));
      if (filterMetodo !== 'Todos') filtered = filtered.filter(o => o.metodo_pago === filterMetodo);
      if (filterTime === 'Hoy') filtered = filtered.filter(o => isToday(new Date(o.created_at)));
      if (filterTime === 'Ayer') filtered = filtered.filter(o => isYesterday(new Date(o.created_at)));
      if (filterTime === '7d') filtered = filtered.filter(o => isAfter(new Date(o.created_at), subDays(new Date(), 7)));
    } else {
      filtered = filtered.filter(o => o.telefono_cliente?.includes('ABONO') || o.telefono_cliente?.includes('LIQUIDACIÓN'));
    }
    if (searchTerm) {
      filtered = filtered.filter(o => (o.nombre_cliente || o.telefono_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return filtered;
  };

  // --- FUNCIONES DE SURTIDO Y ESTADO ---
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
        const msg = `*AMOREE - Confirmación de Pesos* 🥑\n\n¡Hola! Ya pesamos tu pedido con el peso real:\n` +
                    orderToUpdate.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('\n') +
                    `\n\n*TOTAL FINAL: ${formatCurrency(orderToUpdate.total)}*\n\nFavor de enviar comprobante. 🚀`;
        window.open(`https://wa.me/52${telMatch[1]}?text=${encodeURIComponent(msg)}`, '_blank');
      }
      fetchOrders();
    }
  };

  const updateStatus = async (orderId: number, nextStatus: string, order: any) => {
    const payload: any = { estado: nextStatus };
    if (nextStatus === 'Pagado - Por Entregar') payload.metodo_pago = metodoSeleccionado[orderId] || 'Efectivo';
    const { error } = await supabase.from('pedidos').update(payload).eq('id', orderId);
    if (!error) fetchOrders();
  };

  if (loading && view === 'orders') return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.5em]">Titanium OS Radar...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32 font-sans">
      {/* HEADER PRINCIPAL */}
      <div className="bg-black/90 p-6 border-b border-white/5 flex justify-between items-center sticky top-0 z-[100] backdrop-blur-xl">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 border border-white/5">
          {[{ id: 'orders', label: 'Pedidos' }, { id: 'pos', label: 'Terminal' }, { id: 'clients', label: 'Cartera' }, { id: 'stats', label: 'Métricas' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${view === v.id ? 'bg-white text-black shadow-xl' : 'text-gray-500'}`}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'orders' ? (
          <>
            {/* SUB-TABS ADN */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 md:flex-none px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'whatsapp' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 md:flex-none px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
                <button onClick={() => setOrderTab('pagos')} className={`flex-1 md:flex-none px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'pagos' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>🏦 Pagos</button>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {orderTab === 'terminal' && (
                  <select value={filterTime} onChange={(e) => setFilterTime(e.target.value)} className="bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-[9px] font-black uppercase text-green-500 outline-none">
                    <option value="Hoy" className="bg-black">Hoy</option>
                    <option value="Ayer" className="bg-black">Ayer</option>
                    <option value="7d" className="bg-black">7d</option>
                  </select>
                )}
                <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[9px] font-black uppercase outline-none focus:border-green-500 w-40" />
              </div>
            </div>

            {/* VISTA WHATSAPP (TARJETAS) */}
            {orderTab === 'whatsapp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {getFilteredOrders().map(order => (
                  <div key={order.id} className="bg-[#0A0A0A] border border-white/5 rounded-[50px] p-10 shadow-2xl relative">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente || 'Invitado WA'}</h3>
                        <p className="text-[9px] font-black text-gray-500 uppercase">{order.telefono_cliente}</p>
                      </div>
                      <button onClick={() => enviarTicketDigitalWA(order)} className="bg-white/5 p-3 rounded-2xl hover:bg-green-500/20 border border-white/10 transition-all">📱</button>
                    </div>
                    <div className="space-y-3 mb-10">
                      {order.detalle_pedido?.map((item: any) => (
                        <div key={item.sku} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-black text-gray-400 uppercase">{item.nombre}</span>
                          {order.estado === 'Pendiente' ? (
                            <input type="number" step="0.05" value={item.quantity} onChange={(e) => updateItemQuantity(order.id, item.sku, parseFloat(e.target.value))} className="w-20 bg-black border border-green-500/30 text-center rounded-xl py-2 text-xs font-black text-green-500" />
                          ) : (
                            <span className="text-[10px] font-black">{item.quantity}{item.unidad || 'kg'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-end pt-8 border-t border-white/5">
                      <p className="text-4xl font-black">{formatCurrency(order.total)}</p>
                      <div className="flex flex-col gap-2">
                        {order.estado === 'Pendiente' && <button onClick={() => handleConfirmWeights(order.id)} className="bg-green-600 text-white py-3 px-6 rounded-xl text-[9px] font-black uppercase">⚖️ Confirmar</button>}
                        <button onClick={() => updateStatus(order.id, 'Finalizado', order)} className="bg-white text-black py-3 px-6 rounded-xl text-[9px] font-black uppercase">📦 Entregado</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VISTA TERMINAL (ACORDEÓN COMPACTO) */}
            {orderTab === 'terminal' && (
              <div className="bg-[#0A0A0A] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-6 p-6 border-b border-white/10 text-[9px] font-black text-gray-600 uppercase text-center">
                  <span>ID</span><span>Hora</span><span className="text-left">Cliente</span><span>Método</span><span>Total</span><span>Acción</span>
                </div>
                <div className="divide-y divide-white/5">
                  {getFilteredOrders().map(order => (
                    <div key={order.id} className="transition-all hover:bg-white/[0.02]">
                      <div onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)} className="grid grid-cols-6 p-6 items-center cursor-pointer text-center">
                        <span className="text-[10px] font-black text-gray-600">#{order.id}</span>
                        <span className="text-[10px] font-black text-gray-400">{format(new Date(order.created_at), 'HH:mm')}</span>
                        <span className="text-[11px] font-black text-white text-left truncate uppercase italic">{order.nombre_cliente || 'Venta Local'}</span>
                        <span className="text-[9px] font-black text-green-500 uppercase">{order.metodo_pago || 'Efectivo'}</span>
                        <span className="text-lg font-black text-white">{formatCurrency(order.total)}</span>
                        <span className="text-xs">{expandedOrderId === order.id ? '🔼' : '🔽'}</span>
                      </div>
                      {expandedOrderId === order.id && (
                        <div className="p-10 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2">
                          <div className="max-w-2xl mx-auto flex flex-col md:flex-row gap-10 items-center">
                            <div className="flex-1 space-y-2 bg-white/[0.03] p-6 rounded-[30px] border border-white/10 w-full">
                              {order.detalle_pedido?.map((item: any) => (
                                <div key={item.sku} className="flex justify-between text-[10px] font-black uppercase border-b border-white/5 pb-2">
                                  <span className="text-gray-400">{item.nombre}</span>
                                  <span>{item.quantity} {item.unidad || 'kg'} x {formatCurrency(item.precio_venta || item['$ VENTA'])}</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => enviarTicketDigitalWA(order)} className="bg-green-600 text-white p-6 rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-xl flex flex-col items-center gap-2 active:scale-95 transition-transform">
                              <span className="text-2xl">📱</span> Enviar Ticket WA
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VISTA PAGOS */}
            {orderTab === 'pagos' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {getFilteredOrders().map(order => (
                  <div key={order.id} className="bg-[#0A0A0A] border border-blue-500/20 rounded-[40px] p-8 shadow-2xl relative">
                    <div className="flex justify-between items-start">
                      <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-4">Registro Contable</p>
                      <button onClick={() => enviarTicketDigitalWA(order)} className="text-lg">📱</button>
                    </div>
                    <h3 className="text-xl font-black uppercase italic mb-2 leading-none">{order.telefono_cliente?.split(':')[0]}</h3>
                    <p className="text-4xl font-black text-white">{formatCurrency(order.total)}</p>
                    <p className="text-[8px] font-bold text-gray-600 mt-4 uppercase">{format(new Date(order.created_at), 'dd MMM yyyy - HH:mm')}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : view === 'pos' ? <POS onBack={() => setView('orders')} /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </div>
    </div>
  );
}
