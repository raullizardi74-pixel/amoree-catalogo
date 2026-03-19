import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';
import RutaDeCompra from './RutaDeCompra';
import { format } from 'date-fns';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- ESTADOS PARA CORTE DE CAJA ---
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }
  };

  const discountStock = async (items: any[]) => {
    for (const item of items) {
      const { data: product } = await supabase
        .from('productos')
        .select('stock_actual')
        .eq('sku', item.sku || item.SKU)
        .single();

      if (product) {
        const nuevoStock = product.stock_actual - item.quantity;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('sku', item.sku || item.SKU);
      }
    }
  };

  const updateClientDebt = async (nombre: string, telefono: string, monto: number) => {
    const { data: client } = await supabase.from('clientes').select('*').eq('telefono', telefono).single();
    if (client) {
      const nuevoSaldo = (client.saldo_deudor || 0) + monto;
      await supabase.from('clientes').update({ saldo_deudor: nuevoSaldo }).eq('id', client.id);
    } else {
      await supabase.from('clientes').insert([{ nombre: nombre.toUpperCase(), telefono, saldo_deudor: monto }]);
    }
  };

  // --- 🔄 GESTOR DE ESTADOS LÓGICOS ---
  const handleConfirmWeights = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ 
      estado: 'Pendiente de Pago',
      detalle_pedido: order.detalle_pedido,
      total: order.total 
    }).eq('id', order.id);

    if (!error) {
      const msg = `*AMOREE - Confirmación de Pesos* 🥑\n\n¡Hola! Ya pesamos tu pedido:\n` +
                  order.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('\n') +
                  `\n\n*TOTAL FINAL: ${formatCurrency(order.total)}*\n\nFavor de enviar comprobante. 🚀`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleRegisterPayment = async (order: any, metodo: string) => {
    if (metodo === 'A Cuenta') await updateClientDebt(order.nombre_cliente, order.telefono_cliente, order.total);
    const { error } = await supabase.from('pedidos').update({ estado: 'Pagado - Por Entregar', metodo_pago: metodo }).eq('id', order.id);
    if (!error) {
      const msg = metodo === 'A Cuenta' 
        ? `*AMOREE - Registro Crédito* 📑\n\nPedido por *${formatCurrency(order.total)}* registrado A CUENTA.\n\nEntrega PROGRAMADA. 🛵`
        : `*AMOREE - Pago Recibido* ✅\n\nConfirmamos pago por *${formatCurrency(order.total)}* vía *${metodo}*.\n\nEntrega PROGRAMADA. 🛵`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
    if (!error) {
      await discountStock(order.detalle_pedido);
      const msg = `*AMOREE - Pedido Entregado* 📦\n\n¡Tu pedido ha llegado con éxito! Gracias por tu preferencia. 🥑✨`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  // --- 🏦 MOTOR DE CORTE DE CAJA ---
  const prepararCorte = () => {
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = orders.filter(o => 
      new Date(o.created_at).toLocaleDateString() === hoy && 
      o.estado !== 'Cancelado'
    );

    const resumen = ventasHoy.reduce((acc, o) => {
      const metodo = o.metodo_pago || 'Pendiente/Otro';
      acc[metodo] = (acc[metodo] || 0) + o.total;
      acc['Total'] = (acc['Total'] || 0) + o.total;
      return acc;
    }, { 'Efectivo': 0, 'Transferencia': 0, 'Terminal': 0, 'A Cuenta': 0, 'Total': 0 } as any);

    setCorteSummary({ ...resumen, cantidad: ventasHoy.length });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const fecha = format(new Date(), 'dd/MM/yyyy');
    let msg = `*AMOREE - CORTE DE CAJA* 🏦\n`;
    msg += `*Fecha:* ${fecha}\n`;
    msg += `--------------------------\n`;
    msg += `💵 Efectivo: *${formatCurrency(corteSummary.Efectivo)}*\n`;
    msg += `🏦 Transf: *${formatCurrency(corteSummary.Transferencia)}*\n`;
    msg += `💳 Terminal: *${formatCurrency(corteSummary.Terminal)}*\n`;
    msg += `📑 A Cuenta: *${formatCurrency(corteSummary['A Cuenta'])}*\n`;
    msg += `--------------------------\n`;
    msg += `💰 *TOTAL DÍA: ${formatCurrency(corteSummary.Total)}*\n`;
    msg += `📦 Pedidos: ${corteSummary.cantidad}\n\n`;
    msg += `🚀 *Generado por Automatiza con Raul*`;

    const telDuenio = "52XXXXXXXXXX"; // Aquí puedes poner el cel del dueño
    window.open(`https://wa.me/${telDuenio}?text=${encodeURIComponent(msg)}`, '_blank');
    setShowCorteModal(false);
  };

  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') filtered = filtered.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO'));
    else if (orderTab === 'terminal') filtered = filtered.filter(o => o.origen === 'Mostrador');
    if (searchTerm) filtered = filtered.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return filtered;
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
              </div>
              
              <button 
                onClick={prepararCorte}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
              >
                🏦 Corte de Caja
              </button>
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
                      <p className="text-[9px] text-gray-500">{order.telefono_cliente}</p>
                    </div>
                    <p className="text-xl font-black">{formatCurrency(order.total)}</p>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-white/5 pt-8">
                    {order.estado === 'Pendiente' && <button onClick={() => handleConfirmWeights(order)} className="bg-green-600 text-white w-full py-5 rounded-2xl font-black uppercase">⚖️ Confirmar Pesos</button>}
                    {order.estado === 'Pendiente de Pago' && (
                      <div className="grid grid-cols-2 gap-3">
                        {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(metodo => (
                          <button key={metodo} onClick={() => handleRegisterPayment(order, metodo)} className="bg-white/5 border border-white/10 py-4 rounded-xl text-[9px] font-black uppercase hover:bg-white hover:text-black transition-colors">{metodo}</button>
                        ))}
                      </div>
                    )}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => handleDeliver(order)} className="bg-white text-black w-full py-5 rounded-2xl font-black uppercase">📦 Entregado</button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* MODAL DE CORTE DE CAJA */}
        {showCorteModal && corteSummary && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowCorteModal(false)}></div>
            <div className="bg-[#0F0F0F] border border-white/10 rounded-[40px] p-8 md:p-12 w-full max-w-lg relative shadow-2xl animate-in zoom-in-95 duration-200">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2 text-blue-500">Resumen de Corte</h2>
              <p className="text-[10px] font-black text-gray-500 uppercase mb-8">Validación de ventas del día</p>
              
              <div className="space-y-4 mb-10">
                {[
                  { label: '💵 Efectivo', val: corteSummary.Efectivo },
                  { label: '🏦 Transferencias', val: corteSummary.Transferencia },
                  { label: '💳 Terminal', val: corteSummary.Terminal },
                  { label: '📑 A Cuenta', val: corteSummary['A Cuenta'] }
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-gray-400 uppercase">{item.label}</span>
                    <span className="text-lg font-black">{formatCurrency(item.val)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center bg-blue-600/10 p-6 rounded-3xl border border-blue-500/30 mt-6">
                  <span className="text-xs font-black uppercase">Total Ventas</span>
                  <span className="text-3xl font-black text-blue-400">{formatCurrency(corteSummary.Total)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={enviarCorteWA}
                  className="bg-white text-black w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:scale-[1.02] transition-transform"
                >
                  🚀 Confirmar y Enviar a WhatsApp
                </button>
                <button 
                  onClick={() => setShowCorteModal(false)}
                  className="text-gray-500 text-[9px] font-black uppercase hover:text-white transition-colors py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {view === 'ruta' && <RutaDeCompra onBack={() => setView('orders')} />}
        {view === 'pos' && <POS onBack={() => setView('orders')} />}
        {view === 'stats' && <Dashboard />}
        {view === 'clients' && <ClientsModule />}
      </div>
    </div>
  );
}
