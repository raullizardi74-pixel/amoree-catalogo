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

  // --- 1. EXTRACTOR "OMEGA" (DETECTA HORA Y TEL SIN FALLAS) ---
  const extraerDatos = (texto: string) => {
    const textoLimpio = texto || "";
    const telMatch = textoLimpio.match(/(\d{10,12})/);
    // Buscamos cualquier patrón de hora XX:XX que aparezca en el texto
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
          // Detectamos si es pieza o kg basado en la cantidad (si es entero suele ser pieza)
          const unidad = item.nombre.toLowerCase().includes('pieza') || item.quantity % 1 === 0 ? 'pza' : 'kg';
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
    <div className="min-h-screen bg-[#0A0A0A] pb-32 font-sans selection:bg-green-500/30">
      {/* --- HEADER GOLD EDITION --- */}
      <div className="bg-black/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 px-8 py-5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-green-400 to-green-700 p-[1px] rounded-2xl shadow-lg shadow-green-500/20">
            <div className="bg-black rounded-2xl w-11 h-11 flex items-center justify-center text-2xl">🥑</div>
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">Amoree <span className="text-green-500">Business OS</span></h1>
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-1">Control de Ingeniería v2.0</p>
          </div>
        </div>

        {/* --- NAVEGACIÓN ESTILO "DASHBOARD MASTER" --- */}
        <div className="flex bg-white/5 p-1.5 rounded-[22px] border border-white/10 backdrop-blur-md">
          {[
            { id: 'orders', label: 'Pedidos', icon: '📦' },
            { id: 'pos', label: 'TPV', icon: '⚡' },
            { id: 'clients', label: 'Cartera', icon: '💳' },
            { id: 'stats', label: 'Métricas', icon: '📊' }
          ].map((v) => (
            <button 
              key={v.id} 
              onClick={() => setView(v.id as any)} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                view === v.id 
                ? 'bg-green-600 text-white shadow-xl shadow-green-600/30 scale-105' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <span className="text-sm">{v.icon}</span>
              <span className="hidden md:block">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="max-w-6xl mx-auto p-8">
        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row gap-6 mb-12">
              <div className="flex-1 relative group">
                <input 
                  type="text" 
                  placeholder="Rastrear pedido por teléfono..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 px-8 py-5 rounded-[28px] text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-gray-600"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-50 transition-opacity">🔍</div>
              </div>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="bg-white/5 border border-white/10 px-8 py-5 rounded-[28px] text-sm font-black text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              >
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredOrders.map((order) => {
                const { telefono } = extraerDatos(order.telefono_cliente);
                return (
                  <div key={order.id} className="group bg-gradient-to-b from-white/[0.07] to-transparent border border-white/10 rounded-[45px] p-10 hover:border-green-500/30 transition-all duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-[60px] group-hover:bg-green-500/10 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-10 relative z-10">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Canal WhatsApp</p>
                        <h3 className="text-2xl font-black text-white tracking-tighter">{telefono}</h3>
                      </div>
                      <div className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${
                        order.estado === 'Pendiente' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        order.estado === 'Pendiente de Pago' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        'bg-green-500/10 text-green-500 border-green-500/20'
                      }`}>
                        {order.estado}
                      </div>
                    </div>

                    <div className="space-y-3 mb-10 relative z-10">
                      {order.detalle_pedido?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-5 bg-white/5 rounded-[24px] border border-white/5 hover:bg-white/10 transition-colors">
                          <span className="text-sm font-bold text-gray-300">{item.nombre}</span>
                          <div className="flex items-center gap-4">
                            <input 
                              type="number" 
                              value={item.quantity} 
                              onChange={(e) => updateItemQuantity(order.id, item.id, parseFloat(e.target.value))} 
                              className="w-20 bg-black/40 border border-white/10 text-center rounded-xl py-2 text-sm font-black text-green-500 focus:outline-none focus:border-green-500/50" 
                              step="0.05" 
                            />
                            <span className="text-[10px] font-black text-gray-600 uppercase">Unid.</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-white/10 relative z-10">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Inversión Total</p>
                        <p className="text-3xl font-black text-white">{formatCurrency(order.total)}</p>
                      </div>
                      <div className="flex gap-3">
                        {order.estado === 'Pendiente' && (
                          <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="bg-green-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-600/20 hover:bg-green-500 hover:scale-105 active:scale-95 transition-all">⚖️ Confirmar Pesos</button>
                        )}
                        {order.estado === 'Pendiente de Pago' && (
                          <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all">💰 Marcar Pagado</button>
                        )}
                        {order.estado === 'Pagado - Por Entregar' && (
                          <button onClick={() => updateStatus(order.id, 'Finalizado')} className="bg-white/10 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/20 transition-all">📦 Entregado</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === 'pos' ? <POS /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </div>

      {/* --- BOTÓN "MASTER KEY" DE ACCESO FLOTANTE --- */}
      <div className="fixed bottom-8 right-8 z-[60]">
        <button 
          onClick={() => setView('stats')}
          className="group relative p-5 bg-black border border-white/20 rounded-full shadow-[0_0_50px_rgba(34,197,94,0.3)] hover:border-green-500 transition-all duration-500"
        >
          <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl group-hover:blur-2xl transition-all"></div>
          <div className="relative text-2xl group-hover:scale-110 transition-transform">📋</div>
        </button>
      </div>

      {/* SELLO DE GARANTÍA SWISS MADE */}
      <div className="fixed bottom-8 left-8 z-[60]">
         <div className="bg-black/80 backdrop-blur-2xl border border-white/10 p-5 rounded-[30px] flex items-center gap-4 shadow-2xl">
            <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-green-600/20">🚀</div>
            <div>
               <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
               <p className="text-[8px] font-bold text-green-500/50 uppercase tracking-[0.2em]">Socio Tecnológico Gold</p>
            </div>
         </div>
      </div>
    </div>
  );
}
