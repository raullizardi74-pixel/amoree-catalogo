import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  // --- 1. RADAR OMEGA 2.0 (EXTRACTOR DE PRECISIÓN) ---
  const extraerDatos = (texto: string) => {
    const textoLimpio = texto || "";
    const telMatch = textoLimpio.match(/(\d{10,12})/);
    const horaMatch = textoLimpio.match(/(\d{1,2}:\d{2})/);
    
    return {
      telefono: telMatch ? telMatch[1] : "S/T",
      hora: horaMatch ? horaMatch[1] : "Lo antes posible"
    };
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('pedidos').select('*');
      if (error) throw error;
      if (data) {
        const sorted = data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setOrders(sorted);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (orderId: number, nextStatus: string) => {
    const pedidoActual = orders.find(o => o.id === orderId);
    
    if (nextStatus === 'Pendiente de Pago' && pedidoActual) {
      const { telefono, hora } = extraerDatos(pedidoActual.telefono_cliente);
      
      const subtotalProd = pedidoActual.detalle_pedido?.reduce((acc: number, item: any) => 
        acc + (item.quantity * item.precio_venta), 0) || 0;
      const costoEnvio = subtotalProd < 100 ? 30 : 0;
      const totalConEnvio = subtotalProd + costoEnvio;

      const formatHora = (h: string) => {
        if (!h.includes(':')) return h;
        const [horas, minutos] = h.split(':');
        let hh = parseInt(horas);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 || 12;
        return `${h12}:${minutos.substring(0,2)} ${ampm}`;
      };

      const mensaje = `*AMOREE - Confirmación de Pedido* 🥑%0A%0A` +
        `¡Hola! Ya tenemos listo tu pedido y pesamos todo en tienda:%0A` +
        `--------------------------%0A` +
        (pedidoActual.detalle_pedido?.map((item: any) => {
          // --- DETECTOR SEMÁNTICO DE UNIDADES ---
          const n = item.nombre.toLowerCase();
          let unidad = 'kg'; // Default ingeniería
          if (n.includes('pieza') || n.includes('lechuga') || n.includes('melón')) unidad = 'pza';
          if (n.includes('manojo') || n.includes('perejil') || n.includes('espinaca')) unidad = 'manojo';
          
          return `- ${item.nombre}: ${item.quantity}${unidad} x $${item.precio_venta} = *${formatCurrency(item.quantity * item.precio_venta)}*`;
        }).join('%0A')) +
        `%0A--------------------------%0A` +
        `Subtotal: ${formatCurrency(subtotalProd)}%0A` +
        `🚚 Envío: ${formatCurrency(costoEnvio)}%0A` +
        `*TOTAL FINAL: ${formatCurrency(totalConEnvio)}*%0A%0A` +
        `⏰ *HORARIO DE ENTREGA:* ${formatHora(hora)}%0A` +
        `--------------------------%0A%0A` +
        `🏦 *DATOS DE PAGO:*%0A` +
        `*Banco:* BBVA%0A` +
        `*Titular:* Hugo Macario López%0A` +
        `*CLABE:* 012 650 0152436789 0%0A` +
        `*Concepto:* AMOREE ${telefono.slice(-10)}%0A%0A` + 
        `Favor de enviar comprobante para liberar el envío. ¡Gracias! 🚀`;

      window.open(`https://wa.me/${telefono.replace(/\D/g, '')}?text=${mensaje}`, '_blank');
      await supabase.from('pedidos').update({ total: totalConEnvio }).eq('id', orderId);
    }

    const { error } = await supabase.from('pedidos').update({ 
      estado: nextStatus,
      detalle_pedido: pedidoActual?.detalle_pedido
    }).eq('id', orderId);

    if (!error) fetchOrders();
  };

  const updateItemQuantity = (orderId: number, itemId: string, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = (order.detalle_pedido || []).map((item: any) => 
          item.id === itemId ? { ...item, quantity: newQty } : item
        );
        const sub = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * item.precio_venta), 0);
        return { ...order, detalle_pedido: newDetails, total: sub + (sub < 100 ? 30 : 0) };
      }
      return order;
    }));
  };

  const filteredOrders = orders.filter(o => 
    (o.telefono_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'Todos' || o.estado === statusFilter)
  );

  if (loading) return <div className="min-h-screen bg-black flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#070707] pb-32 font-sans selection:bg-green-500/30">
      
      {/* --- HEADER AMOREE GOLD: COCKPIT EDITION --- */}
      <div className="bg-black/90 backdrop-blur-3xl border-b border-white/10 sticky top-0 z-50 px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-6">
            <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-emerald-800 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
               <div className="relative bg-black border border-white/10 rounded-2xl w-14 h-14 flex items-center justify-center text-3xl shadow-2xl">🥑</div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Amoree</h1>
                <span className="bg-green-600/10 border border-green-500/20 text-green-500 text-[8px] px-2 py-0.5 rounded-full font-black tracking-widest uppercase">OS GOLD</span>
              </div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.4em] mt-2">Socio: <span className="text-gray-300">Raul Lizardi</span></p>
            </div>
          </div>

          <div className="flex bg-white/[0.03] p-1.5 rounded-[26px] border border-white/5 backdrop-blur-md shadow-inner">
            {[
              { id: 'orders', label: 'Pedidos', icon: '📦' },
              { id: 'pos', label: 'Terminal', icon: '⚡' },
              { id: 'clients', label: 'Cartera', icon: '💳' },
              { id: 'stats', label: 'Inteligencia', icon: '🧠' }
            ].map((v) => (
              <button 
                key={v.id} 
                onClick={() => setView(v.id as any)} 
                className={`flex items-center gap-3 px-6 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
                  view === v.id 
                  ? 'bg-gradient-to-br from-green-500 to-green-700 text-white shadow-2xl shadow-green-500/40 scale-105' 
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <span className="text-base">{v.icon}</span>
                <span className="hidden lg:block">{v.label}</span>
              </button>
            ))}
          </div>

          <div className="hidden xl:flex items-center gap-4 border-l border-white/10 pl-6">
            <div className="text-right">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Sistema</p>
                <p className="text-[10px] font-bold text-green-500">ONLINE</p>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,1)]"></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row gap-6 mb-16">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Rastreo de Pedido por WhatsApp..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-white/[0.02] border border-white/10 px-10 py-6 rounded-[32px] text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 transition-all placeholder:text-gray-700"
                />
              </div>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="bg-black border border-white/10 px-10 py-6 rounded-[32px] text-sm font-black text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 appearance-none"
              >
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {filteredOrders.map((order) => {
                const { telefono } = extraerDatos(order.telefono_cliente);
                return (
                  <div key={order.id} className="group bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-[50px] p-10 hover:border-green-500/40 transition-all duration-700 relative shadow-2xl">
                    
                    <div className="flex justify-between items-start mb-12">
                      <div>
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.4em] mb-3">WhatsApp Order</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter">{telefono}</h3>
                      </div>
                      <div className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-2xl ${
                        order.estado === 'Pendiente' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        order.estado === 'Pendiente de Pago' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        'bg-green-500/10 text-green-500 border-green-500/20'
                      }`}>
                        {order.estado}
                      </div>
                    </div>

                    <div className="space-y-4 mb-12">
                      {order.detalle_pedido?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-6 bg-white/[0.02] rounded-[28px] border border-white/5 hover:bg-white/5 transition-all">
                          <span className="text-sm font-bold text-gray-300">{item.nombre}</span>
                          <div className="flex items-center gap-4">
                            <input 
                              type="number" 
                              value={item.quantity} 
                              onChange={(e) => updateItemQuantity(order.id, item.id, parseFloat(e.target.value))} 
                              className="w-20 bg-black/60 border border-white/10 text-center rounded-xl py-2 text-sm font-black text-green-500" 
                              step="0.05" 
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-10 border-t border-white/10">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Liquidación</p>
                        <p className="text-4xl font-black text-white">{formatCurrency(order.total)}</p>
                      </div>
                      <div className="flex gap-4">
                        {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="bg-green-600 text-white px-8 py-5 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-green-600/30 hover:scale-105 active:scale-95 transition-all">⚖️ Confirmar</button>}
                        {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="bg-blue-600 text-white px-8 py-5 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:scale-105 transition-all">💰 Pagó</button>}
                        {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado')} className="bg-white/10 text-white px-8 py-5 rounded-[22px] text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">📦 Fin</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === 'pos' ? <POS /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </div>

      {/* --- BOTÓN "MASTER CONTROL" FLOTANTE --- */}
      <div className="fixed bottom-10 right-10 z-[60]">
        <button 
          onClick={() => setView('stats')}
          className="group relative p-6 bg-black border border-white/20 rounded-[30px] shadow-[0_0_60px_rgba(34,197,94,0.2)] hover:border-green-500 transition-all duration-700"
        >
          <div className="absolute inset-0 rounded-[30px] bg-green-500/20 blur-2xl group-hover:blur-3xl transition-all"></div>
          <div className="relative flex items-center gap-3">
             <span className="text-2xl group-hover:rotate-12 transition-transform">📋</span>
             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] hidden md:block">Acceso Master</span>
          </div>
        </button>
      </div>

      {/* FOOTER SWISS MADE */}
      <div className="fixed bottom-10 left-10 z-[60]">
         <div className="bg-black/90 backdrop-blur-3xl border border-white/10 p-6 rounded-[35px] flex items-center gap-5 shadow-2xl">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-800 rounded-2xl flex items-center justify-center text-2xl shadow-xl">🚀</div>
            <div>
               <p className="text-[11px] font-black text-white uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
               <p className="text-[8px] font-bold text-green-500/60 uppercase tracking-[0.3em]">Engineering Intelligence</p>
            </div>
         </div>
      </div>
    </div>
  );
}
