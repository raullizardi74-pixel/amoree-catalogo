import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';
import RutaDeCompra from './RutaDeCompra';
import InventoryModule from './InventoryModule'; 
import ReciboModule from './ReciboModule'; 
import { Scanner } from './Scanner';
import { format } from 'date-fns';
import { 
  Package, LayoutDashboard, ShoppingBag, Users, 
  BarChart3, Truck, Calculator, X, Clock, creditCard 
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const handleConfirmWeights = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ 
      estado: 'Pendiente de Pago',
      detalle_pedido: order.detalle_pedido,
      total: order.total 
    }).eq('id', order.id);

    if (!error) {
      const msg = `*AMOREE - Pesos Confirmados* 🥑\n\n¡Hola! Ya pesamos tu pedido:\n` +
                  order.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('\n') +
                  `\n\n*TOTAL FINAL: ${formatCurrency(order.total)}*\n\nFavor de enviar comprobante. 🚀`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleRegisterPayment = async (order: any, metodo: string) => {
    if (metodo === 'A Cuenta') {
      const { data: client } = await supabase.from('clientes').select('*').eq('telefono', order.telefono_cliente).single();
      if (client) {
        await supabase.from('clientes').update({ saldo_deudor: (client.saldo_deudor || 0) + order.total }).eq('id', client.id);
      } else {
        await supabase.from('clientes').insert([{ nombre: order.nombre_cliente.toUpperCase(), telefono: order.telefono_cliente, saldo_deudor: order.total }]);
      }
    }

    const { error } = await supabase.from('pedidos').update({ estado: 'Pagado - Por Entregar', metodo_pago: metodo }).eq('id', order.id);
    if (!error) {
      const msg = metodo === 'A Cuenta' 
        ? `*AMOREE - Crédito Registrado* 📑\n\nPedido por *${formatCurrency(order.total)}* registrado A CUENTA.\n\nEntrega PROGRAMADA. 🛵`
        : `*AMOREE - Pago Recibido* ✅\n\nConfirmamos pago por *${formatCurrency(order.total)}* vía *${metodo}*.\n\nEntrega PROGRAMADA. 🛵`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
    if (!error) {
      await discountStock(order.detalle_pedido);
      const msg = `*AMOREE - Pedido Entregado* 📦\n\n¡Tu pedido ha llegado! Gracias por tu confianza. 🥑✨`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const prepararCorte = () => {
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = orders.filter(o => 
      new Date(o.created_at).toLocaleDateString() === hoy && 
      o.estado !== 'Cancelado'
    );

    const resumen = ventasHoy.reduce((acc, o) => {
      const metodo = o.metodo_pago || 'Efectivo';
      acc[metodo] = (acc[metodo] || 0) + o.total;
      acc['Total'] = (acc['Total'] || 0) + o.total;
      return acc;
    }, { 'Efectivo': 0, 'Transferencia': 0, 'Terminal': 0, 'A Cuenta': 0, 'Total': 0 } as any);

    setCorteSummary({ ...resumen, cantidad: ventasHoy.length });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const fecha = format(new Date(), 'dd/MM/yyyy');
    let msg = `*AMOREE - CORTE DE CAJA* 🏦\n*Fecha:* ${fecha}\n--------------------------\n`;
    msg += `💵 Efectivo: *${formatCurrency(corteSummary.Efectivo)}*\n🏦 Transf: *${formatCurrency(corteSummary.Transferencia)}*\n`;
    msg += `💳 Terminal: *${formatCurrency(corteSummary.Terminal)}*\n📑 A Cuenta: *${formatCurrency(corteSummary['A Cuenta'])}*\n--------------------------\n`;
    msg += `💰 *TOTAL DÍA: ${formatCurrency(corteSummary.Total)}*\n📦 Pedidos: ${corteSummary.cantidad}\n\n🚀 *Automatiza con Raul*`;

    sendWA("52XXXXXXXXXX", msg); 
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
      {/* HEADER DE NAVEGACIÓN TITANIUM */}
      <div className="bg-black/90 p-4 md:p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center sticky top-0 z-[100] backdrop-blur-xl gap-4">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
          {[
            { id: 'orders', label: 'Pedidos', icon: <ShoppingBag size={14}/> },
            { id: 'inventory', label: 'Inventario', icon: <Package size={14}/> },
            { id: 'recibo', label: 'Recibo', icon: <Truck size={14}/> },
            { id: 'pos', label: 'Terminal', icon: <Calculator size={14}/> },
            { id: 'clients', label: 'Cartera', icon: <Users size={14}/> },
            { id: 'ruta', label: 'Ruta', icon: <Truck size={14}/> },
            { id: 'stats', label: 'Métricas', icon: <BarChart3 size={14}/> }
          ].map(v => (
            <button 
              key={v.id} 
              onClick={() => setView(v.id as any)} 
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${view === v.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* --- RENDER PRINCIPAL (GESTOR DE VISTAS) --- */}
        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
              </div>
              <button onClick={prepararCorte} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Calculator size={16}/> Corte de Caja
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {getFilteredOrders().map(order => (
                <div key={order.id} className={`bg-[#0A0A0A] border rounded-[50px] p-10 transition-all ${order.estado === 'Finalizado' ? 'border-white/5 opacity-70' : 'border-white/10 shadow-2xl'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {/* Estatus del pedido */}
                        <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase inline-block ${order.estado === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-500' : order.estado === 'Pendiente de Pago' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}`}>
                          {order.estado}
                        </span>
                        {/* ✅ NUEVA ETIQUETA: MÉTODO DE PAGO */}
                        <span className="text-[8px] font-black px-3 py-1 rounded-full uppercase bg-white/5 text-gray-400">
                          {order.metodo_pago || 'Efectivo'}
                        </span>
                      </div>
                      
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente}</h3>
                      
                      {/* ✅ NUEVA LÍNEA: HORA DE LA VENTA */}
                      <p className="text-[9px] text-gray-600 font-black mt-1 uppercase tracking-widest">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {order.telefono_cliente}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{formatCurrency(order.total)}</p>
                      <p className="text-[8px] text-gray-700 font-bold uppercase mt-1">ID: #{order.id.toString().slice(-4)}</p>
                    </div>
                  </div>

                  {/* ✅ LISTA RÁPIDA DE PRODUCTOS (Mini-Ticket) */}
                  <div className="flex flex-wrap gap-2 mb-6 pt-4 border-t border-white/5">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <span key={idx} className="text-[7px] font-black uppercase bg-white/[0.03] px-2 py-1 rounded-md text-gray-500 border border-white/5">
                        {item.quantity}{item.unidad || 'kg'} {item.nombre}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-4 border-t border-white/5 pt-8">
                    {order.estado === 'Pendiente' && <button onClick={() => handleConfirmWeights(order)} className="bg-green-600 text-white w-full py-5 rounded-2xl font-black uppercase">⚖️ Confirmar Pesos</button>}
                    {order.estado === 'Pendiente de Pago' && (
                      <div className="grid grid-cols-2 gap-3">
                        {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                          <button key={m} onClick={() => handleRegisterPayment(order, m)} className="bg-white/5 border border-white/10 py-4 rounded-xl text-[9px] font-black uppercase hover:bg-white hover:text-black transition-colors">{m}</button>
                        ))}
                      </div>
                    )}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => handleDeliver(order)} className="bg-white text-black w-full py-5 rounded-2xl font-black uppercase">📦 Marcar Entregado</button>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : view === 'inventory' ? (
          <InventoryModule onBack={() => setView('orders')} />
        ) : view === 'recibo' ? (
          <ReciboModule onBack={() => setView('orders')} />
        ) : view === 'ruta' ? (
          <RutaDeCompra onBack={() => setView('orders')} />
        ) : view === 'pos' ? (
          <POS onBack={() => setView('orders')} />
        ) : view === 'stats' ? (
          <Dashboard />
        ) : (
          <ClientsModule />
        )}
      </div>

      {/* MODAL CORTE DE CAJA */}
      {showCorteModal && corteSummary && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0F0F0F] border border-white/10 rounded-[40px] p-10 w-full max-w-lg relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowCorteModal(false)} className="absolute top-8 right-8 text-gray-500"><X/></button>
            <h2 className="text-3xl font-black uppercase italic text-blue-500 mb-8">Resumen de Corte</h2>
            <div className="space-y-4 mb-10">
              {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                <div key={m} className="flex justify-between items-center bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black text-gray-400 uppercase">{m}</span>
                  <span className="text-lg font-black">{formatCurrency(corteSummary[m])}</span>
                </div>
              ))}
              <div className="flex justify-between items-center bg-blue-600/10 p-6 rounded-3xl border border-blue-500/30 mt-6">
                <span className="text-xs font-black uppercase">Ventas Totales</span>
                <span className="text-3xl font-black text-blue-400">{formatCurrency(corteSummary.Total)}</span>
              </div>
            </div>
            <button onClick={enviarCorteWA} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[11px]">Confirmar y Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
