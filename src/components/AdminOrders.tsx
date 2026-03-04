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

  // --- MOTOR DE UNIDADES SEMÁNTICO V5 ---
  const getUnit = (name: string) => {
    const n = name.toLowerCase();
    if (['pieza', 'lechuga', 'melón', 'sandía', 'piña', 'apio', 'pepino', 'coco', 'papaya', 'coliflor'].some(k => n.includes(k))) return 'pza';
    if (['manojo', 'cilantro', 'perejil', 'espinaca', 'acelga', 'rábano', 'cebollita'].some(k => n.includes(k))) return 'manojo';
    return 'kg';
  };

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
      const subtotal = pedidoActual.detalle_pedido?.reduce((acc: number, item: any) => acc + (item.quantity * item.precio_venta), 0) || 0;
      const envio = subtotal < 100 ? 30 : 0;
      const totalFinal = subtotal + envio;

      const formatHora = (h: string) => {
        if (!h.includes(':')) return h;
        const [horas, minutos] = h.split(':');
        let hh = parseInt(horas);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 || 12;
        return `${h12}:${minutos.substring(0,2)} ${ampm}`;
      };

      const mensaje = `*AMOREE - Confirmación* 🥑%0A%0A` +
        `¡Hola! Pesamos tu pedido en tienda:%0A` +
        `--------------------------%0A` +
        (pedidoActual.detalle_pedido?.map((item: any) => 
          `- ${item.nombre}: ${item.quantity}${getUnit(item.nombre)} x $${item.precio_venta} = *${formatCurrency(item.quantity * item.precio_venta)}*`
        ).join('%0A')) +
        `%0A--------------------------%0A` +
        `Subtotal: ${formatCurrency(subtotal)}%0A` +
        `🚚 Envío: ${formatCurrency(envio)}%0A` +
        `*TOTAL: ${formatCurrency(totalFinal)}*%0A%0A` +
        `⏰ *HORARIO:* ${formatHora(hora)}%0A%0A` +
        `🏦 *PAGO:* BBVA / Hugo Macario López%0A*CLABE:* 012 650 0152436789 0%0A*Concepto:* ${telefono}%0A%0A` + 
        `Favor de enviar comprobante. ¡Gracias! 🚀`;

      window.open(`https://wa.me/${telefono.replace(/\D/g, '')}?text=${mensaje}`, '_blank');
      await supabase.from('pedidos').update({ total: totalFinal }).eq('id', orderId);
    }
    const { error } = await supabase.from('pedidos').update({ estado: nextStatus, detalle_pedido: pedidoActual?.detalle_pedido }).eq('id', orderId);
    if (!error) fetchOrders();
  };

  const updateItemQuantity = (orderId: number, itemId: string, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = (order.detalle_pedido || []).map((item: any) => item.id === itemId ? { ...item, quantity: newQty } : item);
        const sub = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * item.precio_venta), 0);
        return { ...order, detalle_pedido: newDetails, total: sub + (sub < 100 ? 30 : 0) };
      }
      return order;
    }));
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-[3px] border-green-500/10 border-t-green-500 rounded-full animate-spin"></div>
      <p className="mt-6 text-[10px] font-black text-green-500 uppercase tracking-[0.5em]">Sincronizando Sistemas...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white/90 font-sans">
      
      {/* HEADER DINÁMICO TIPO CABINA */}
      <header className="bg-black/60 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl w-12 h-12 flex items-center justify-center text-2xl shadow-2xl">🥑</div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">Amoree</h1>
              <p className="text-[7px] font-bold text-green-500 tracking-[0.4em] mt-1 uppercase">Titanium Edition</p>
            </div>
          </div>

          <nav className="flex bg-white/[0.02] p-1.5 rounded-[22px] border border-white/5">
            {[
              { id: 'orders', label: 'Pedidos', icon: '📦' },
              { id: 'pos', label: 'Terminal', icon: '⚡' },
              { id: 'clients', label: 'Cartera', icon: '💳' },
              { id: 'stats', label: 'Analytics', icon: '🧠' }
            ].map((v) => (
              <button 
                key={v.id} 
                onClick={() => setView(v.id as any)} 
                className={`flex items-center gap-2 px-6 py-3 rounded-[18px] text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${
                  view === v.id ? 'bg-white text-black scale-105' : 'text-gray-500 hover:text-white'
                }`}
              >
                <span className="text-sm">{v.icon}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {view === 'orders' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {orders.filter(o => (o.telefono_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()) && (statusFilter === 'Todos' || o.estado === statusFilter)).map((order) => (
              <div key={order.id} className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                <div className="flex justify-between items-start mb-10">
                  <h3 className="text-xl font-black text-white">{extraerDatos(order.telefono_cliente).telefono}</h3>
                  <span className="px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/20">{order.estado}</span>
                </div>
                <div className="space-y-3 mb-10">
                  {order.detalle_pedido?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                      <span className="text-xs text-gray-400">{item.nombre}</span>
                      <input type="number" value={item.quantity} onChange={(e) => updateItemQuantity(order.id, item.id, parseFloat(e.target.value))} className="w-16 bg-black border border-white/10 text-center rounded-lg py-1 text-xs font-black text-white" step="0.05" />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-8 border-t border-white/5">
                  <p className="text-2xl font-black text-white">{formatCurrency(order.total)}</p>
                  <div className="flex gap-2">
                    {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="bg-green-600 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase">⚖️ Surtir</button>}
                    {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="bg-white text-black px-6 py-3 rounded-xl text-[9px] font-black uppercase">💰 Cobrar</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : view === 'pos' ? (
          <POS onBack={() => setView('orders')} />
        ) : view === 'stats' ? <Dashboard /> : <ClientsModule />}
      </main>

      {/* --- CSS INYECTADO PARA ARREGLAR CONTRASTE EN MODALES --- */}
      <style>{`
        input, .amount-input, .swal2-input, [role="dialog"] input { 
          color: #000000 !important; 
          background-color: #ffffff !important;
          font-weight: 900 !important; 
          border: 2px solid #e2e8f0 !important;
        }
        .amount-display { color: #ffffff !important; }
      `}</style>
    </div>
  );
}
