import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';
import RutaDeCompra from './RutaDeCompra';
import InventoryModule from './InventoryModule'; 
import ReciboModule from './ReciboModule'; 
import AuditoriaModule from './AuditoriaModule';
import { format } from 'date-fns';
import { 
  Package, ShoppingBag, Users, BarChart3, Truck, 
  Calculator, X, ShieldCheck, Search, Scale, CheckCircle2, Send, CreditCard, Wallet
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [comprasHoy, setComprasHoy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo' | 'auditoria'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ ESTADOS DE FLUJO AMOREE (BÁSCULA Y PAGOS)
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isWeighing, setIsWeighing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tempItems, setTempItems] = useState<any[]>([]);

  // ESTADOS DEL CORTE MAESTRO
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);
  const [fondoCaja, setFondoCaja] = useState(1500); 
  const [otrosGastos, setOtrosGastos] = useState(0); 
  const [efectivoFisico, setEfectivoFisico] = useState(0);

  const BANCO_DATOS = `\n--------------------------\n*DATOS DE PAGO* 💳\nBENEFICIARIO: Rocío Perez\nBANCO: BANCO AZTECA\nCUENTA CLABE: 4027665785902702\n--------------------------`;

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
      const { data: c } = await supabase.from('compras').select('*').gte('created_at', inicio).lte('created_at', fin);
      
      if (p) setOrders(p);
      if (c) setComprasHoy(c || []);
    } catch (e) { console.error("Sync Error:", e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [view]);

  // ✅ FIX TITANIUM: Toma los primeros 10 dígitos (ignora fecha/hora del campo)
  const sendWA = (telefono: string, mensaje: string) => {
    const onlyNumbers = (telefono || '').replace(/\D/g, '');
    const cleanTel = onlyNumbers.slice(0, 10);
    if (cleanTel && cleanTel.length === 10) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    } else {
      alert("Número de teléfono no válido para WhatsApp.");
    }
  };

  // ✅ PASO (c): SURTIDO Y PESO REAL
  const openWeighing = (order: any) => {
    setSelectedOrder(order);
    setTempItems([...order.detalle_pedido]);
    setIsWeighing(true);
  };

  const handleWeightChange = (idx: number, newQty: number) => {
    const newItems = [...tempItems];
    newItems[idx].quantity = newQty;
    setTempItems(newItems);
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
    } catch (e) { alert("Error al actualizar peso."); }
  };

  // ✅ PASO (d): CONFIRMAR PAGO
  const handleConfirmPayment = async (metodo: string) => {
    try {
      await supabase.from('pedidos').update({ 
        estado: 'Pendiente por Entregar',
        metodo_pago: metodo 
      }).eq('id', selectedOrder.id);

      let msg = `*PAGO CONFIRMADO* 🧾\n--------------------------\n👤 CLIENTE: ${selectedOrder.nombre_cliente}\n✅ Hemos recibido tu pago vía *${metodo}*.\n🚚 Tu pedido está en ruta de entrega.`;
      
      sendWA(selectedOrder.telefono_cliente, msg);
      setShowPaymentModal(false);
      fetchData();
    } catch (e) { alert("Error al confirmar pago."); }
  };

  // ✅ PASO (e) y (f): ENTREGA Y FINALIZACIÓN
  const finalizeDelivery = async (order: any) => {
    try {
      await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
      let msg = `*PEDIDO ENTREGADO* 🚚🏠\n--------------------------\n¡Muchas gracias por tu compra en *AMOREE*! Esperamos que disfrutes tus productos frescos.\n\n_Tu pedido ha sido marcado como finalizado._`;
      sendWA(order.telefono_cliente, msg);
      fetchData();
    } catch (e) { alert("Error al finalizar."); }
  };

  // ✅ LÓGICA DE FILTRADO
  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') filtered = filtered.filter(o => o.origen !== 'Mostrador');
    else if (orderTab === 'terminal') filtered = filtered.filter(o => o.origen === 'Mostrador');
    if (searchTerm) filtered = filtered.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return filtered;
  };

  // ✅ LÓGICA DE CORTE
  const prepararCorte = async () => {
    await fetchData(); 
    const ventasEfectivoHoy = orders.filter(o => o.estado === 'Finalizado' && (o.metodo_pago === 'Efectivo' || !o.metodo_pago)).reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    const totalRecibos = comprasHoy.reduce((acc, curr) => acc + (Number(curr.total) || Number(curr.total_compra) || 0), 0);
    const esperado = fondoCaja + ventasEfectivoHoy - totalRecibos - otrosGastos;
    setCorteSummary({ ventasEfectivo: ventasEfectivoHoy, totalRecibos: totalRecibos, esperado: esperado, detallesRecibos: comprasHoy });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const { hoyLegible } = getMexicoRange();
    const dif = efectivoFisico - corteSummary.esperado;
    let msg = `*AMOREE - CORTE MAESTRO* 🏦\n*Fecha:* ${hoyLegible}\n--------------------------\n`;
    msg += `💰 Fondo Inicial: *${formatCurrency(fondoCaja)}*\n💵 Ventas Efectivo: *${formatCurrency(corteSummary.ventasEfectivo)}*\n🚚 Pagos Recibos: *-${formatCurrency(corteSummary.totalRecibos)}*\n`;
    if(otrosGastos > 0) msg += `📝 Otros Gastos: *-${formatCurrency(otrosGastos)}*\n`;
    msg += `--------------------------\n🎯 *ESPERADO: ${formatCurrency(corteSummary.esperado)}*\n✋ *FÍSICO: ${formatCurrency(efectivoFisico)}*\n`;
    msg += `--------------------------\n`;
    msg += dif < 0 ? `⚠️ FALTANTE: *${formatCurrency(dif)}*` : dif > 0 ? `✅ SOBRANTE: *${formatCurrency(dif)}*` : `💎 CAJA CUADRADA`;
    sendWA("2215306435", msg); // Número de Hugo/Raúl
    setShowCorteModal(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* BARRA DE NAVEGACIÓN SUPERIOR */}
      <div className="bg-black/90 p-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-center sticky top-0 z-[100] backdrop-blur-xl gap-4">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
          {[
            { id: 'orders', label: 'Pedidos', icon: <ShoppingBag size={14}/> },
            { id: 'inventory', label: 'Almacén', icon: <Package size={14}/> },
            { id: 'recibo', label: 'Recibo', icon: <Truck size={14}/> },
            { id: 'pos', label: 'Terminal', icon: <Calculator size={14}/> },
            { id: 'clients', label: 'Cartera', icon: <Users size={14}/> },
            { id: 'ruta', label: 'Ruta', icon: <Truck size={14}/> },
            { id: 'stats', label: 'Métricas', icon: <BarChart3 size={14}/> },
            { id: 'auditoria', label: 'Auditoría', icon: <ShieldCheck size={14}/> }
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${view === v.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'orders' ? (
          <>
            {/* HERRAMIENTAS DE PEDIDOS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
              </div>
              <div className="flex-1 w-full relative">
                 <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                 <input type="text" placeholder="BUSCAR PEDIDO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/5 rounded-[22px] py-4 pl-16 pr-8 text-[10px] font-black uppercase outline-none focus:border-green-500" />
              </div>
              <button onClick={prepararCorte} className="w-full md:w-auto bg-blue-600 text-white px-10 py-4 rounded-[22px] text-[10px] font-black uppercase flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Calculator size={16}/> Corte de Caja
              </button>
            </div>

            {/* LISTA DE PEDIDOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {getFilteredOrders().map(order => {
                const status = (order.estado || '').toUpperCase();
                const isFinalized = status === 'FINALIZADO';
                
                return (
                  <div key={order.id} className={`bg-[#0A0A0A] border rounded-[40px] p-8 transition-all ${isFinalized ? 'opacity-40 grayscale border-white/5' : 'border-white/10 shadow-2xl hover:border-green-500/30'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-[8px] font-black uppercase px-3 py-1 rounded-full bg-green-600/20 text-green-500 mb-2 inline-block border border-green-500/20">{order.estado}</span>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente}</h3>
                        <p className="text-[9px] text-gray-600 font-black mt-1 uppercase tracking-widest">{format(new Date(order.created_at), 'HH:mm')} hrs</p>
                      </div>
                      <p className="text-2xl font-black text-green-500">{formatCurrency(order.total)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-8">
                      {order.detalle_pedido?.map((item: any, idx: number) => (
                        <span key={idx} className="text-[8px] font-black uppercase bg-white/[0.05] px-3 py-1.5 rounded-lg text-gray-400">{item.quantity}{item.unidad || 'kg'} {item.nombre}</span>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      {/* PASO C: SURTIR (Fix: acepta PENDIENTE o PENDIENCE) */}
                      {(status === 'PENDIENTE' || status === 'PENDIENCE') && (
                        <button onClick={() => openWeighing(order)} className="w-full bg-green-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95"><Scale size={16}/> Surtir y Pesar (Báscula)</button>
                      )}

                      {/* PASO D: COBRAR */}
                      {status === 'PENDIENTE POR PAGAR' && (
                        <button onClick={() => { setSelectedOrder(order); setShowPaymentModal(true); }} className="w-full bg-amber-500 text-black py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95"><CreditCard size={16}/> Confirmar Pago del Cliente</button>
                      )}

                      {/* PASO E: ENTREGAR */}
                      {status === 'PENDIENTE POR ENTREGAR' && (
                        <button onClick={() => finalizeDelivery(order)} className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95"><Truck size={16}/> Confirmar Entrega Realizada</button>
                      )}

                      {isFinalized && <p className="text-center text-[9px] font-black text-gray-600 uppercase tracking-widest">Pedido Completado ✅</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === 'inventory' ? <InventoryModule onBack={() => setView('orders')} /> 
          : view === 'recibo' ? <ReciboModule onBack={() => setView('orders')} />
          : view === 'ruta' ? <RutaDeCompra onBack={() => setView('orders')} />
          : view === 'pos' ? <POS onBack={() => setView('orders')} />
          : view === 'stats' ? <Dashboard />
          : view === 'auditoria' ? <AuditoriaModule onBack={() => setView('orders')} />
          : <ClientsModule />}
      </div>

      {/* ✅ MODAL BÁSCULA (Paso C) */}
      {isWeighing && selectedOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-2xl shadow-3xl">
            <div className="flex justify-between items-start mb-10">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter text-green-500">Ajuste de Báscula</h2>
              <button onClick={() => setIsWeighing(false)} className="bg-white/5 p-3 rounded-full hover:bg-red-500 transition-all"><X size={24}/></button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4 mb-10 no-scrollbar">
              {tempItems.map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 p-6 rounded-[30px] flex justify-between items-center">
                  <div className="flex-1">
                    <p className="text-[11px] font-black uppercase text-white">{item.nombre}</p>
                    <p className="text-[8px] font-bold text-gray-500 uppercase">{formatCurrency(item.precio_venta)} / {item.unidad || 'kg'}</p>
                  </div>
                  <div className="flex items-center gap-4 bg-black p-2 rounded-2xl border border-white/5">
                    <input 
                      type="number" 
                      step={item.unidad === 'pza' ? 1 : 0.05}
                      value={item.quantity} 
                      onChange={(e) => handleWeightChange(idx, parseFloat(e.target.value) || 0)}
                      className="bg-transparent w-24 text-center text-xl font-black text-green-500 outline-none"
                    />
                    <span className="text-[10px] font-black text-gray-400 uppercase">{item.unidad || 'kg'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-white/5 flex justify-between items-center">
              <p className="text-3xl font-black text-white">{formatCurrency(calculateTempTotal())}</p>
              <button onClick={saveAndNotifySurtido} className="bg-green-600 hover:bg-green-500 text-white px-12 py-5 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl active:scale-95 transition-all">
                <Send size={18}/> Guardar y Notificar Total
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL PAGO (Paso D) */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-md text-center">
            <h2 className="text-2xl font-black uppercase text-amber-500 mb-8">Confirmar Pago</h2>
            <div className="grid grid-cols-1 gap-3">
              {['Efectivo', 'Transferencia', 'Tarjeta', 'A Cuenta'].map(m => (
                <button key={m} onClick={() => handleConfirmPayment(m)} className="bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 active:scale-95 transition-all">{m}</button>
              ))}
            </div>
            <button onClick={() => setShowPaymentModal(false)} className="mt-8 text-gray-500 uppercase text-[9px] font-black hover:text-white transition-colors">Regresar</button>
          </div>
        </div>
      )}

      {/* ✅ MODAL CORTE MAESTRO (Manteniendo toda tu lógica intacta) */}
      {showCorteModal && corteSummary && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl overflow-y-auto">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-4xl relative shadow-2xl flex flex-col md:flex-row gap-8 my-auto">
            <button onClick={() => setShowCorteModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X/></button>
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-black uppercase italic text-blue-500 mb-8">Corte Maestro</h2>
              <div className="bg-black/50 p-6 rounded-3xl border border-white/5">
                <label className="text-[8px] font-black text-gray-500 uppercase block mb-2">Fondo de Caja (Inicio)</label>
                <input type="number" value={fondoCaja} onChange={(e) => setFondoCaja(Number(e.target.value))} className="bg-transparent text-xl font-black text-white outline-none w-full" />
              </div>
              <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                <p className="text-[8px] font-black text-gray-500 uppercase mb-4 tracking-widest italic">Recibos Detectados</p>
                <div className="space-y-3 max-h-40 overflow-y-auto no-scrollbar">
                  {corteSummary.detallesRecibos.map((r: any) => (
                    <div key
