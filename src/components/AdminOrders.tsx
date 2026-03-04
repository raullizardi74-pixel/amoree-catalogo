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

  // --- 1. MOTOR DE INFERENCIA DE DATOS (RADAR OMEGA V3) ---
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
      const totalFinal = subtotalProd + costoEnvio;

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
          // --- MOTOR DE UNIDADES SEMÁNTICO (TITANIUM) ---
          const n = item.nombre.toLowerCase();
          let unidad = 'kg'; // Estándar Amoree
          
          const pzaKeywords = ['pieza', 'lechuga', 'melón', 'sandía', 'coliflor', 'brócoli', 'piña', 'apio', 'pepino', 'coco'];
          const manojoKeywords = ['manojo', 'cilantro', 'perejil', 'espinaca', 'acelga', 'rábano', 'cebollita', 'quelite'];
          
          if (pzaKeywords.some(k => n.includes(k))) unidad = 'pza';
          if (manojoKeywords.some(k => n.includes(k))) unidad = 'manojo';
          
          return `- ${item.nombre}: ${item.quantity}${unidad} x $${item.precio_venta} = *${formatCurrency(item.quantity * item.precio_venta)}*`;
        }).join('%0A')) +
        `%0A--------------------------%0A` +
        `Subtotal: ${formatCurrency(subtotalProd)}%0A` +
        `🚚 Envío: ${formatCurrency(costoEnvio)}%0A` +
        `*TOTAL FINAL: ${formatCurrency(totalFinal)}*%0A%0A` +
        `⏰ *HORARIO DE ENTREGA:* ${formatHora(hora)}%0A` +
        `--------------------------%0A%0A` +
        `🏦 *DATOS DE PAGO:*%0A` +
        `*Banco:* BBVA%0A` +
        `*Titular:* Hugo Macario López%0A` +
        `*CLABE:* 012 650 0152436789 0%0A` +
        `*Concepto:* AMOREE ${telefono.slice(-10)}%0A%0A` + 
        `Favor de enviar comprobante para liberar el envío. ¡Gracias! 🚀`;

      window.open(`https://wa.me/${telefono.replace(/\D/g, '')}?text=${mensaje}`, '_blank');
      await supabase.from('pedidos').update({ total: totalFinal }).eq('id', orderId);
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

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-[3px] border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
      <p className="mt-6 text-[10px] font-black text-green-500 uppercase tracking-[0.5em] animate-pulse">Iniciando Sistemas...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white/90 pb-32 font-sans selection:bg-green-500/30">
      
      {/* --- HEADER TITANIUM: AEROSPACE CONTROL --- */}
      <header className="bg-black/40 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col lg:flex-row items-center justify-between gap-8">
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute -inset-2 bg-green-500/20 blur-2xl rounded-full"></div>
              <div className="relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl w-16 h-16 flex items-center justify-center text-3xl shadow-2xl">🥑</div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tighter uppercase italic">Amoree</h1>
                <div className="h-4 w-[1px] bg-white/10"></div>
                <span className="text-[10px] font-black text-green-500 tracking-[0.3em] uppercase">Business OS</span>
              </div>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.4em] mt-2">Versión Titanium <span className="text-white/20">|</span> Socio: Raul Lizardi</p>
            </div>
          </div>

          <nav className="flex bg-white/[0.02] p-2 rounded-[30px] border border-white/5 shadow-2xl">
            {[
              { id: 'orders', label: 'Centro de Pedidos', icon: '📦' },
              { id: 'pos', label: 'Terminal TPV', icon: '⚡' },
              { id: 'clients', label: 'Cartera Clientes', icon: '💳' },
              { id: 'stats', label: 'BI & Analíticas', icon: '🧠' }
            ].map((v) => (
              <button 
                key={v.id} 
                onClick={() => setView(v.id as any)} 
                className={`flex items-center gap-3 px-8 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all duration-700 ${
                  view === v.id 
                  ? 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.1)] scale-105' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{v.icon}</span>
                <span className="hidden sm:block">{v.label}</span>
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-6 border-l border-white/10 pl-8">
            <div className="text-right">
                <p className="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-1">Status Global</p>
                <p className="text-[10px] font-bold text-green-400">ENCRIPTADO</p>
            </div>
            <div className="relative w-3 h-3">
               <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>
               <div className="relative w-3 h-3 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.8)]"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-10">
        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row gap-8 mb-20">
              <div className="flex-1 group">
                <input 
                  type="text" 
                  placeholder="Escaneando base de datos por teléfono..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-white/[0.03] border border-white/5 px-10 py-7 rounded-[35px] text-white text-sm focus:outline-none focus:border-green-500/50 transition-all placeholder:text-gray-700"
                />
              </div>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)} 
                className="bg-black border border-white/5 px-10 py-7 rounded-[35px] text-sm font-black text-gray-500 focus:outline-none focus:border-green-500/50 appearance-none cursor-pointer"
              >
                {['Todos', 'Pendiente', 'Pendiente de Pago', 'Pagado - Por Entregar', 'Finalizado'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {filteredOrders.map((order) => {
                const { telefono } = extraerDatos(order.telefono_cliente);
                return (
                  <div key={order.id} className="group bg-[#0A0A0A] border border-white/5 rounded-[60px] p-12 hover:border-white/20 transition-all duration-1000 relative shadow-2xl">
                    <div className="flex justify-between items-start mb-14">
                      <div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em] mb-4">ID Transacción</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter">{telefono}</h3>
                      </div>
                      <div className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border ${
                        order.estado === 'Pendiente' ? 'bg-amber-500/5 text-amber-500 border-amber-500/10' : 
                        order.estado === 'Pendiente de Pago' ? 'bg-blue-500/5 text-blue-400 border-blue-500/10' : 
                        'bg-green-500/5 text-green-500 border-green-500/10'
                      }`}>
                        {order.estado}
                      </div>
                    </div>

                    <div className="space-y-4 mb-14">
                      {order.detalle_pedido?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-7 bg-white/[0.01] border border-white/[0.03] rounded-[30px] hover:bg-white/[0.03] transition-colors">
                          <span className="text-sm font-bold text-gray-400">{item.nombre}</span>
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => updateItemQuantity(order.id, item.id, parseFloat(e.target.value))} 
                            className="w-24 bg-black border border-white/10 text-center rounded-2xl py-3 text-sm font-black text-white" 
                            step="0.05" 
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-12 border-t border-white/5">
                      <div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Total Neto</p>
                        <p className="text-4xl font-black text-white">{formatCurrency(order.total)}</p>
                      </div>
                      <div className="flex gap-4">
                        {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="bg-green-600 text-white px-10 py-5 rounded-[25px] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-green-600/20 hover:scale-105 transition-all">⚖️ Surtir</button>}
                        {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="bg-white text-black px-10 py-5 rounded-[25px] text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">💰 Liquidar</button>}
                        {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado')} className="bg-white/5 text-white px-10 py-5 rounded-[25px] text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">📦 Cerrar</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === 'pos' ? <POS /> : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </main>

      {/* --- BOTÓN "MASTER CONSOLE" --- */}
      <div className="fixed bottom-12 right-12 z-[60]">
        <button 
          onClick={() => setView('stats')}
          className="group relative p-8 bg-white text-black rounded-[35px] shadow-[0_0_80px_rgba(255,255,255,0.1)] hover:scale-110 transition-all duration-500"
        >
          <div className="relative flex items-center gap-4">
             <span className="text-3xl">📋</span>
             <span className="text-[11px] font-black uppercase tracking-[0.3em] hidden lg:block">Panel de Control</span>
          </div>
        </button>
      </div>

      <div className="fixed bottom-12 left-12 z-[60]">
         <div className="bg-black/80 backdrop-blur-3xl border border-white/10 p-7 rounded-[40px] flex items-center gap-6 shadow-2xl">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-900 rounded-2xl flex items-center justify-center text-3xl shadow-xl">🚀</div>
            <div>
               <p className="text-[12px] font-black text-white uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
               <p className="text-[9px] font-bold text-green-500/40 uppercase tracking-[0.4em]">Next-Gen Software Lab</p>
            </div>
         </div>
      </div>
    </div>
  );
}
