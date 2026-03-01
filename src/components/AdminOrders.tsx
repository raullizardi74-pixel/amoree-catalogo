import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats'>('orders');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('pedidos').select('*');
    if (data) {
      // PRIORIDADES: 
      // 1. Pendiente (Nuevo)
      // 2. Pendiente de Pago (Ya se envió ticket)
      // 3. Pagado (Cerrado)
      // 4. Cancelado
      const statusWeight: Record<string, number> = {
        'Pendiente': 1,
        'Pendiente de Pago': 2,
        'Pagado': 3,
        'Cancelado': 4
      };
      const sorted = data.sort((a, b) => {
        const weightA = statusWeight[a.estado] || 5;
        const weightB = statusWeight[b.estado] || 5;
        if (weightA !== weightB) return weightA - weightB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setOrders(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // --- FUNCIÓN MAESTRA: ENVIAR TICKET DIGITAL CON DATOS BANCARIOS ---
  const sendDigitalTicket = async (order: any) => {
    // 1. Limpieza de teléfono para WhatsApp
    const rawPhone = order.telefono_cliente.split(' ')[0].replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;

    // 2. CONFIGURACIÓN DE DATOS BANCARIOS (Socio, edita estos campos con los reales)
    const datosBancarios = {
      banco: "BBVA / BANCOPPEL",
      nombre: "HUGO [APELLIDO]",
      clabe: "0123 4567 8901 2345 67",
      tarjeta: "4152 0000 0000 0000"
    };

    // 3. Construcción del Mensaje (Ticket Digital)
    let ticket = `*TICKET DIGITAL - AMOREE* ✅\n`;
    ticket += `_Tu pedido ya está pesado y listo para envío_\n`;
    ticket += `--------------------------\n`;
    order.detalle_pedido.forEach((item: any) => {
      const subtotal = item.precio_venta * item.quantity;
      ticket += `• ${item.quantity.toFixed(3)} ${item.unidad} x ${item.nombre} = ${formatCurrency(subtotal)}\n`;
    });
    ticket += `--------------------------\n`;
    ticket += `💰 *TOTAL A PAGAR: ${formatCurrency(order.total)}*\n\n`;
    
    // SECCIÓN DE TRANSFERENCIA
    ticket += `*DATOS PARA TRANSFERENCIA:* 🏦\n`;
    ticket += `• *Banco:* ${datosBancarios.banco}\n`;
    ticket += `• *Nombre:* ${datosBancarios.nombre}\n`;
    ticket += `• *CLABE:* \`${datosBancarios.clabe}\` (Toca para copiar)\n`;
    ticket += `• *Tarjeta:* \`${datosBancarios.tarjeta}\`\n\n`;
    
    ticket += `_Favor de enviar el comprobante por aquí para liberar tu entrega._ 🥑`;

    // 4. Actualizar estado en DB y disparar WhatsApp
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        estado: 'Pendiente de Pago',
        detalle_pedido: order.detalle_pedido,
        total: order.total 
      })
      .eq('id', order.id);

    if (!error) {
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(ticket)}`;
      window.open(waUrl, '_blank');
      fetchOrders();
    }
  };

  const finalizeOrder = async (orderId: number) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Pagado' }).eq(id, orderId);
    if (!error) fetchOrders();
  };

  const updateItemQuantity = (orderId: number, itemIdx: number, newQty: number) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const newDetails = [...order.detalle_pedido];
        newDetails[itemIdx] = { ...newDetails[itemIdx], quantity: newQty };
        const newTotal = newDetails.reduce((sum, item) => sum + (item.precio_venta * item.quantity), 0);
        return { ...order, detalle_pedido: newDetails, total: newTotal };
      }
      return order;
    }));
  };

  const filteredOrders = orders.filter(o => o.telefono_cliente?.includes(searchTerm));

  if (loading) return <div className="p-10 text-center font-black text-green-700 animate-pulse uppercase">Cargando Sistema...</div>;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* ENCABEZADO Y SELECTOR DE VISTA */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">Panel <span className="text-green-600">Admin</span></h1>
          <div className="flex bg-gray-200 p-1 rounded-2xl shadow-inner">
            <button 
              onClick={() => setView('orders')} 
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'orders' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              📦 Pedidos
            </button>
            <button 
              onClick={() => setView('stats')} 
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'stats' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500'}`}
            >
              📊 Estadísticas
            </button>
          </div>
        </div>

        {view === 'orders' ? (
          <>
            {/* BUSCADOR */}
            <div className="mb-6 relative">
              <input 
                type="text" 
                placeholder="🔍 Buscar por teléfono..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full p-4 rounded-2xl border-0 shadow-sm font-bold focus:ring-4 focus:ring-green-100 transition-all outline-none" 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden transition-all hover:shadow-md">
                  {/* CABECERA DE TARJETA */}
                  <div className={`p-4 border-b ${
                    order.estado === 'Pendiente' ? 'bg-orange-50' : 
                    order.estado === 'Pendiente de Pago' ? 'bg-blue-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase">ID: #{order.id}</span>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                        order.estado === 'Pendiente de Pago' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {order.estado}
                      </span>
                    </div>
                    <p className="font-black text-gray-800 text-sm leading-tight">{order.telefono_cliente}</p>
                  </div>

                  {/* CUERPO - AJUSTE DE PESOS */}
                  <div className="p-4 flex-1 space-y-2 max-h-60 overflow-y-auto">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <span className="flex-1 text-[11px] font-bold text-gray-700 leading-tight">{item.nombre}</span>
                        <input 
                          type="number" 
                          step="0.001" 
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(order.id, idx, parseFloat(e.target.value))}
                          className="w-20 border-2 border-green-200 rounded-lg text-center font-black text-xs text-green-700 bg-white py-1 outline-none focus:border-green-500"
                        />
                        <span className="text-[9px] font-black text-gray-400 w-8 uppercase">{item.unidad}</span>
                      </div>
                    ))}
                  </div>

                  {/* ACCIONES */}
                  <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-black text-gray-400 uppercase">Total Real:</span>
                      <span className="text-xl font-black text-gray-900">{formatCurrency(order.total)}</span>
                    </div>

                    {order.estado === 'Pendiente' && (
                      <button 
                        onClick={() => sendDigitalTicket(order)} 
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                      >
                        🚀 Enviar Ticket y Cobrar
                      </button>
                    )}

                    {order.estado === 'Pendiente de Pago' && (
                      <button 
                        onClick={() => finalizeOrder(order.id)} 
                        className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all"
                      >
                        💰 Confirmar Pago Recibido
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <Dashboard />}
      </div>
    </div>
  );
}
