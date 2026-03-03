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

  const fetchOrders = async () => {
    try {
      console.log("Iniciando sincronización...");
      setLoading(true);
      setErrorMsg(null);
      
      const { data, error } = await supabase.from('pedidos').select('*');
      
      if (error) throw error;

      if (data) {
        const statusWeight: Record<string, number> = {
          'Pendiente': 1, 
          'Pendiente de Pago': 2, 
          'Pagado - Por Entregar': 3, 
          'Finalizado': 4, 
          'Cancelado': 5
        };
        const sorted = data.sort((a, b) => {
          const weightA = statusWeight[a.estado] || 6;
          const weightB = statusWeight[b.estado] || 6;
          if (weightA !== weightB) return weightA - weightB;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setOrders(sorted);
      }
    } catch (err: any) {
      console.error("Error en Supabase:", err.message);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // SEGURO ANTI-SPINNER: Si después de 4 segundos sigue cargando, lo apagamos a la fuerza
  useEffect(() => {
    fetchOrders();
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const updateStatus = async (orderId: number, nextStatus: string) => {
    const pedidoActual = orders.find(o => o.id === orderId);
    
    if (nextStatus === 'Pendiente de Pago' && pedidoActual) {
      // EXTRACCIÓN LIMPIA: Ignoramos nombres o fechas raras
      const partes = (pedidoActual.telefono_cliente || "").split(':').map((p: string) => p.trim());
      const telefono = partes[0] || 'Cliente';
      
      // Buscamos la hora (el único elemento que contenga ":" y no sea el teléfono)
      const horaSucia = partes.find((p: string) => p.includes(':') && p !== telefono) || 'A convenir';

      const formatHora = (h: string) => {
        if (!h.includes(':')) return h;
        try {
          const [horas, minutos] = h.split(':');
          let hh = parseInt(horas);
          const ampm = hh >= 12 ? 'PM' : 'AM';
          hh = hh % 12 || 12;
          return `${hh}:${minutos.substring(0,2)} ${ampm}`;
        } catch { return "Lo antes posible"; }
      };

      const horaFinal = formatHora(horaSucia);
      const numWhatsApp = pedidoActual.whatsapp_contacto || telefono;

      const mensaje = `*AMOREE - Confirmación de Pedido* 🥑%0A%0A` +
        `Hola, *Cliente de Amoree*, ya pesamos tus productos en tienda:%0A` +
        `--------------------------%0A` +
        (pedidoActual.detalle_pedido?.map((item: any) => 
          `- ${item.nombre}: ${item.quantity}kg x $${item.precio_venta} = *${formatCurrency(item.quantity * item.precio_venta)}*`
        ).join('%0A') || 'Calculando detalles...') +
        `%0A--------------------------%0A` +
        `*TOTAL FINAL: ${formatCurrency(pedidoActual.total)}*%0A` +
        `🚚 *HORARIO DE ENTREGA:* ${horaFinal}%0A` +
        `--------------------------%0A%0A` +
        `🏦 *DATOS DE PAGO:*%0A` +
        `*Banco:* BBVA%0A` +
        `*Titular:* Hugo Macario López%0A` +
        `*CLABE:* 012 650 0152436789 0%0A` +
        `*Concepto:* ${telefono.slice(-10)}%0A%0A` + 
        `Favor de enviar comprobante por este medio. ¡Gracias! 🚀`;

      window.open(`https://wa.me/${numWhatsApp.replace(/\D/g, '')}?text=${mensaje}`, '_blank');
    }

    const { error } = await supabase.from('pedidos').update({ 
      estado: nextStatus,
      total: pedidoActual?.total,
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
        const newTotal = newDetails.reduce((acc: number, item: any) => acc + (item.quantity * item.precio_venta), 0);
        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    }));
  };

  const filteredOrders = orders.filter(order => {
    const searchStr = (order.telefono_cliente || '').toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase()) &&
           (statusFilter === 'Todos' || order.estado === statusFilter);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 text-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronizando con Amoree Cloud...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-32">
      {/* HEADER */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-green-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg">🥑</div>
          <h1 className="text-xl font-black text-gray-900 uppercase">Amoree <span className="text-green-600">OS</span></h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
          <button onClick={() => setView('orders')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'orders' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Pedidos</button>
          <button onClick={() => setView('pos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'pos' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>TPV</button>
          <button onClick={() => setView('clients')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'clients' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Cartera</button>
          <button onClick={() => setView('stats')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'stats' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}>Stats</button>
        </div>
      </div>

      {errorMsg && (
        <div className="max-w-5xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 p-4 rounded-3xl text-red-600 text-[10px] font-black uppercase text-center">
            ⚠️ Error: {errorMsg}
          </div>
        </div>
      )}

      {view === 'pos' ? <POS /> : view === 'orders' ? (
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-white border border-gray-200 px-6 py-4 rounded-3xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600/20" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-gray-200 px-6 py-4 rounded-3xl text-sm font-bold text-gray-700 shadow-sm">
              <option>Todos</option>
              <option>Pendiente</option>
              <option>Pendiente de Pago</option>
              <option>Pagado - Por Entregar</option>
              <option>Finalizado</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOrders.length === 0 && !errorMsg && (
              <p className="col-span-full text-center text-gray-400 text-[10px] font-black uppercase py-20">No hay pedidos registrados</p>
            )}
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-[40px] p-8 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                    <h3 className="text-lg font-black text-gray-900 leading-tight">Cliente Amoree</h3>
                    <p className="text-xs font-bold text-gray-400 mt-1">{order.telefono_cliente?.split(':')[0] || 'S/T'}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                    order.estado === 'Pendiente' ? 'bg-amber-100 text-amber-600' :
                    order.estado === 'Pendiente de Pago' ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-600'
                  }`}>{order.estado}</span>
                </div>

                <div className="space-y-4 mb-8">
                  {order.detalle_pedido?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-3xl border border-gray-100">
                      <span className="text-sm font-bold text-gray-800">{item.nombre}</span>
                      <div className="flex items-center gap-3">
                        <input type="number" value={item.quantity} onChange={(e) => updateItemQuantity(order.id, item.id, parseFloat(e.target.value))} className="w-16 bg-white border border-gray-200 text-center rounded-xl py-1 text-sm font-black focus:outline-none" step="0.05" />
                        <span className="text-xs font-bold text-gray-400">kg</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Final</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(order.total || 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    {order.estado === 'Pendiente' && <button onClick={() => updateStatus(order.id, 'Pendiente de Pago')} className="bg-green-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all">⚖️ Confirmar Pesos</button>}
                    {order.estado === 'Pendiente de Pago' && <button onClick={() => updateStatus(order.id, 'Pagado - Por Entregar')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all">💰 Marcar Pagado</button>}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => updateStatus(order.id, 'Finalizado')} className="bg-gray-800 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all">📦 Entregado</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : view === 'stats' ? <Dashboard /> : <ClientsModule />}

      {/* SELLO DE GARANTÍA */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
         <div className="bg-white/90 backdrop-blur-xl border border-gray-200 p-4 rounded-3xl flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
               <div className="bg-green-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg">🚀</div>
               <div>
                  <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Socio Tecnológico Amoree</p>
               </div>
            </div>
            <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
            <div className="text-right">
               <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-1">Swiss Made</p>
               <p className="text-[10px] font-bold text-gray-900 leading-none">V2.0</p>
            </div>
         </div>
      </div>
    </div>
  );
}
