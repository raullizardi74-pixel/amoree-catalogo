import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';
import RutaDeCompra from './RutaDeCompra';
import { format, isToday, isYesterday, subDays, isAfter } from 'date-fns';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // --- 🚀 MOTOR DE COMUNICACIÓN WHATSAPP ---
  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }
  };

  // --- 📦 MOTOR DE INVENTARIO TITANIUM ---
  const discountStock = async (items: any[]) => {
    for (const item of items) {
      const { data: product } = await supabase
        .from('productos')
        .select('stock_actual')
        .eq('sku', item.sku || item.SKU)
        .single();

      if (product) {
        const nuevoStock = product.stock_actual - item.quantity;
        await supabase
          .from('productos')
          .update({ stock_actual: nuevoStock })
          .eq('sku', item.sku || item.SKU);
      }
    }
  };

  // --- 🔄 GESTOR DE ESTADOS LÓGICOS ---

  // 1. Confirmar Pesos -> Mueve a "Pendiente de Pago"
  const handleConfirmWeights = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ 
      estado: 'Pendiente de Pago',
      detalle_pedido: order.detalle_pedido,
      total: order.total 
    }).eq('id', order.id);

    if (!error) {
      const msg = `*AMOREE - Confirmación de Pesos* 🥑\n\n¡Hola! Ya pesamos tu pedido:\n` +
                  order.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('\n') +
                  `\n\n*TOTAL FINAL: ${formatCurrency(order.total)}*\n\nFavor de enviar comprobante para programar tu entrega. 🚀`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  // 2. Registrar Pago -> Mueve a "Pagado - Por Entregar"
  const handleRegisterPayment = async (order: any, metodo: string) => {
    const { error } = await supabase.from('pedidos').update({ 
      estado: 'Pagado - Por Entregar',
      metodo_pago: metodo 
    }).eq('id', order.id);

    if (!error) {
      const msg = `*AMOREE - Pago Recibido* ✅\n\nConfirmamos tu pago por *${formatCurrency(order.total)}* vía *${metodo}*.\n\nTu entrega ha quedado *PROGRAMADA*. En breve te notificaremos cuando el repartidor vaya en camino. ¡Gracias! 🛵`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  // 3. Finalizar Entrega -> Mueve a "Finalizado" y DESCUENTA STOCK
  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);

    if (!error) {
      await discountStock(order.detalle_pedido);
      const msg = `*AMOREE - Pedido Entregado* 📦\n\n¡Tu pedido ha llegado a su destino! \n\nGracias por confiar en nosotros. Esperamos que disfrutes tus productos. 🥑✨`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  // --- LÓGICA DE FILTRADO ---
  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') {
      filtered = filtered.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO'));
    } else if (orderTab === 'terminal') {
      filtered = filtered.filter(o => o.origen === 'Mostrador');
    }
    if (searchTerm) {
      filtered = filtered.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return filtered;
  };

  const updateItemQuantity = (orderId: number, itemSku: string, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = (order.detalle_pedido || []).map((item: any) => 
          (item.sku || item.SKU) === itemSku ? { ...item, quantity: newQty } : item
        );
        const sub = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * (item.precio_venta || item['$ VENTA'])), 0);
        return { ...order, detalle_pedido: newDetails, total: sub };
      }
      return order;
    }));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* HEADER */}
      <div className="bg-black/90 p-6 border-b border-white/5 flex justify-between items-center sticky top-0 z-[100] backdrop-blur-xl">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
          {['orders', 'ruta', 'pos', 'clients', 'stats'].map(v => (
            <button key={v} onClick={() => setView(v as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${view === v ? 'bg-white text-black' : 'text-gray-500'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'orders' && (
          <>
            <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 mb-10">
              <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
              <button onClick={() => setOrderTab('terminal')} className={`flex-1 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {getFilteredOrders().map(order => (
                <div key={order.id} className={`bg-[#0A0A0A] border rounded-[50px] p-10 transition-all ${order.estado === 'Finalizado' ? 'opacity-50 grayscale border-white/5' : 'border-white/10 shadow-2xl'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase mb-2 inline-block ${order.estado === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-500' : order.estado === 'Pendiente de Pago' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}`}>
                        {order.estado}
                      </span>
                      <h3 className="text-2xl font-black uppercase italic">{order.nombre_cliente}</h3>
                    </div>
                    <p className="text-xl font-black">{formatCurrency(order.total)}</p>
                  </div>

                  {/* DETALLE Y AJUSTE */}
                  <div className="space-y-3 mb-10">
                    {order.detalle_pedido?.map((item: any) => (
                      <div key={item.sku} className="flex justify-between items-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-gray-400 uppercase">{item.nombre}</span>
                        {order.estado === 'Pendiente' ? (
                          <input type="number" step="0.01" value={item.quantity} onChange={(e) => updateItemQuantity(order.id, item.sku, parseFloat(e.target.value))} className="w-24 bg-black border border-green-500/30 text-center rounded-xl py-2 text-xs font-black text-green-500" />
                        ) : (
                          <span className="text-[10px] font-black">{item.quantity} {item.unidad || 'kg'}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ACCIONES DINÁMICAS */}
                  <div className="flex flex-col gap-4 border-t border-white/5 pt-8">
                    {order.estado === 'Pendiente' && (
                      <button onClick={() => handleConfirmWeights(order)} className="bg-green-600 text-white w-full py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-transform">⚖️ Confirmar Pesos y Enviar</button>
                    )}

                    {order.estado === 'Pendiente de Pago' && (
                      <div className="grid grid-cols-2 gap-3">
                        <p className="col-span-2 text-[10px] font-black text-center text-blue-400 mb-2">REGISTRAR PAGO RECIBIDO:</p>
                        {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(metodo => (
                          <button key={metodo} onClick={() => handleRegisterPayment(order, metodo)} className="bg-white/5 border border-white/10 py-4 rounded-xl text-[9px] font-black uppercase hover:bg-white hover:text-black transition-colors">{metodo}</button>
                        ))}
                      </div>
                    )}

                    {order.estado === 'Pagado - Por Entregar' && (
                      <button onClick={() => handleDeliver(order)} className="bg-white text-black w-full py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3">📦 Marcar como Entregado</button>
                    )}

                    {order.estado === 'Finalizado' && (
                      <p className="text-center text-[10px] font-black text-gray-600 italic">Pedido completado con éxito ✓</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
        {view === 'ruta' && <RutaDeCompra onBack={() => setView('orders')} />}
        {view === 'pos' && <POS onBack={() => setView('orders')} />}
        {view === 'stats' && <Dashboard />}
        {view === 'clients' && <ClientsModule />}
      </div>
    </div>
  );
}
