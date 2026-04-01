import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { 
  Package, ShoppingBag, Users, BarChart3, Truck, 
  Calculator, X, ShieldCheck, Search, Scale, CheckCircle2, Send, CreditCard, Wallet
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [comprasHoy, setComprasHoy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ ESTADOS DE FLUJO AMOREE
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isWeighing, setIsWeighing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tempItems, setTempItems] = useState<any[]>([]);

  const BANCO_DATOS = `\n--------------------------\n*DATOS DE PAGO* 💳\nBENEFICIARIO: Rocío Perez\nBANCO: BANCO AZTECA\nCLABE: 4027665785902702\n--------------------------`;

  const getMexicoRange = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const baseMX = formatter.format(new Date());
    return {
      inicio: `${baseMX}T00:00:00-06:00`,
      fin: `${baseMX}T23:59:59-06:00`,
      hoyLegible: baseMX.split('-').reverse().join('/')
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { inicio, fin } = getMexicoRange();
      const { data: p } = await supabase.from('pedidos').select('*').gte('created_at', inicio).lte('created_at', fin).order('created_at', { ascending: false });
      if (p) setOrders(p);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.replace(/\D/g, '').slice(-10);
    if (cleanTel) window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  // ✅ PASO (c): SURTIDO Y PESO REAL
  const openWeighing = (order: any) => {
    setSelectedOrder(order);
    setTempItems([...order.detalle_pedido]);
    setIsWeighing(true);
  };

  const calculateTempTotal = () => {
    const sub = tempItems.reduce((acc, i) => acc + (i.quantity * i.precio_venta), 0);
    return sub + (sub > 0 && sub < 100 ? 30 : 0);
  };

  const saveAndNotifySurtido = async () => {
    const finalTotal = calculateTempTotal();
    try {
      await supabase.from('pedidos').update({ 
        detalle_pedido: tempItems, 
        total: finalTotal, 
        estado: 'Pendiente por Pagar' 
      }).eq('id', selectedOrder.id);

      let msg = `*PEDIDO SURTIDO - TOTAL REAL* ✅\n👤 CLIENTE: ${selectedOrder.nombre_cliente}\n💰 *TOTAL A PAGAR: ${formatCurrency(finalTotal)}*\n\nSu pedido ha sido pesado con báscula real.${BANCO_DATOS}\n\n_Favor de enviar comprobante por este medio._`;
      
      sendWA(selectedOrder.telefono_cliente, msg);
      setIsWeighing(false);
      fetchData();
    } catch (e) { alert("Error"); }
  };

  // ✅ PASO (d): CONFIRMAR PAGO
  const handleConfirmPayment = async (metodo: string) => {
    try {
      await supabase.from('pedidos').update({ 
        estado: 'Pendiente por Entregar',
        metodo_pago: metodo 
      }).eq('id', selectedOrder.id);

      // Si es "A Cuenta", podrías disparar aquí la actualización del saldo del cliente.

      let msg = `*PAGO CONFIRMADO* 🧾\n--------------------------\n👤 CLIENTE: ${selectedOrder.nombre_cliente}\n✅ Hemos recibido tu pago vía *${metodo}*.\n🚚 Tu pedido está en ruta de entrega.`;
      
      sendWA(selectedOrder.telefono_cliente, msg);
      setShowPaymentModal(false);
      fetchData();
    } catch (e) { alert("Error"); }
  };

  // ✅ PASO (e) y (f): ENTREGA Y FINALIZACIÓN
  const finalizeDelivery = async (order: any) => {
    try {
      await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
      let msg = `*PEDIDO ENTREGADO* 🚚🏠\n--------------------------\n¡Muchas gracias por tu compra en *AMOREE*! Esperamos que disfrutes tus productos frescos.\n\n_Tu pedido ha sido marcado como finalizado._`;
      sendWA(order.telefono_cliente, msg);
      fetchData();
    } catch (e) { alert("Error"); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* HEADER Business OS */}
      <div className="bg-black/90 p-4 border-b border-white/5 sticky top-0 z-[100] backdrop-blur-xl flex justify-between items-center">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
          <button onClick={() => setView('orders')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${view === 'orders' ? 'bg-white text-black' : 'text-gray-500'}`}>PEDIDOS</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-max mb-10">
          <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {orders.filter(o => orderTab === 'whatsapp' ? o.origen !== 'Mostrador' : true).map(order => {
            const status = (order.estado || '').toUpperCase();
            const isFinalized = status === 'FINALIZADO';
            
            return (
              <div key={order.id} className={`bg-[#0A0A0A] border rounded-[40px] p-8 transition-all ${isFinalized ? 'opacity-40 grayscale border-white/5' : 'border-white/10 shadow-2xl'}`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[8px] font-black uppercase px-3 py-1 rounded-full bg-green-600/20 text-green-500 mb-2 inline-block border border-green-500/20">{order.estado}</span>
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente}</h3>
                  </div>
                  <p className="text-2xl font-black text-green-500">{formatCurrency(order.total)}</p>
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                  {order.detalle_pedido?.map((item: any, idx: number) => (
                    <span key={idx} className="text-[8px] font-black uppercase bg-white/[0.05] px-3 py-1.5 rounded-lg text-gray-400">{item.quantity}{item.unidad} {item.nombre}</span>
                  ))}
                </div>

                <div className="pt-6 border-t border-white/5">
                  {/* PASO C: SURTIR (Acepta PENDIENTE o PENDIENCE) */}
                  {(status === 'PENDIENTE' || status === 'PENDIENCE') && (
                    <button onClick={() => openWeighing(order)} className="w-full bg-green-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Scale size={16}/> Surtir y Pesar (Báscula)</button>
                  )}

                  {/* PASO D: COBRAR */}
                  {status === 'PENDIENTE POR PAGAR' && (
                    <button onClick={() => { setSelectedOrder(order); setShowPaymentModal(true); }} className="w-full bg-amber-500 text-black py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><CreditCard size={16}/> Confirmar Pago del Cliente</button>
                  )}

                  {/* PASO E: ENTREGAR */}
                  {status === 'PENDIENTE POR ENTREGAR' && (
                    <button onClick={() => finalizeDelivery(order)} className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><Truck size={16}/> Confirmar Entrega Realizada</button>
                  )}

                  {isFinalized && <p className="text-center text-[9px] font-black text-gray-600 uppercase tracking-widest">Pedido Completado</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL BÁSCULA (Paso C) */}
      {isWeighing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-2xl">
            <h2 className="text-3xl font-black uppercase italic text-green-500 mb-8">Ajuste de Báscula</h2>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-10 no-scrollbar">
              {tempItems.map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] p-4 rounded-2xl flex justify-between items-center border border-white/5">
                  <span className="text-[11px] font-black uppercase">{item.nombre}</span>
                  <input type="number" step="0.01" value={item.quantity} onChange={(e) => {
                    const n = [...tempItems]; n[idx].quantity = parseFloat(e.target.value) || 0; setTempItems(n);
                  }} className="bg-black text-green-500 text-right font-black w-20 outline-none" />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-8">
              <p className="text-3xl font-black">{formatCurrency(calculateTempTotal())}</p>
              <button onClick={saveAndNotifySurtido} className="bg-green-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2"><Send size={14}/> Guardar y Notificar Total</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAGO (Paso D) */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-md text-center">
            <h2 className="text-2xl font-black uppercase text-amber-500 mb-8">Confirmar Pago</h2>
            <div className="grid grid-cols-1 gap-3">
              {['Efectivo', 'Transferencia', 'Tarjeta', 'A Cuenta'].map(m => (
                <button key={m} onClick={() => handleConfirmPayment(m)} className="bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5">{m}</button>
              ))}
            </div>
            <button onClick={() => setShowPaymentModal(false)} className="mt-8 text-gray-500 uppercase text-[9px] font-black">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
