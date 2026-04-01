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
  Calculator, X, ShieldCheck, Search, Scale, CheckCircle2, Send
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [comprasHoy, setComprasHoy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo' | 'auditoria'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ ESTADOS DE SURTIDO (BAASCULA)
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isWeighing, setIsWeighing] = useState(false);
  const [tempItems, setTempItems] = useState<any[]>([]);

  // ESTADOS DEL CORTE MAESTRO
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);
  const [fondoCaja, setFondoCaja] = useState(1500); 
  const [otrosGastos, setOtrosGastos] = useState(0); 
  const [efectivoFisico, setEfectivoFisico] = useState(0);

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
      const { data: p } = await supabase.from('pedidos')
        .select('*')
        .gte('created_at', inicio)
        .lte('created_at', fin)
        .order('created_at', { ascending: false });

      const { data: c } = await supabase.from('compras')
        .select('*')
        .gte('created_at', inicio)
        .lte('created_at', fin);

      if (p) setOrders(p);
      if (c) setComprasHoy(c || []);
    } catch (error) {
      console.error("Error en Sync:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [view]);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  // ✅ MOTOR DE SURTIDO: Abrir Modal
  const openWeighing = (order: any) => {
    setSelectedOrder(order);
    setTempItems([...order.detalle_pedido]);
    setIsWeighing(true);
  };

  // ✅ MOTOR DE SURTIDO: Actualizar Peso en tiempo real
  const handleWeightChange = (idx: number, newQty: number) => {
    const newItems = [...tempItems];
    newItems[idx].quantity = newQty;
    setTempItems(newItems);
  };

  const calculateTempTotal = () => {
    const subtotal = tempItems.reduce((acc, item) => acc + (item.quantity * item.precio_venta), 0);
    const shipping = (subtotal > 0 && subtotal < 100) ? 30 : 0;
    return subtotal + shipping;
  };

  // ✅ MOTOR DE SURTIDO: Guardar y avisar a Cliente
  const saveAndNotify = async () => {
    const finalTotal = calculateTempTotal();
    try {
      const { error } = await supabase.from('pedidos')
        .update({ 
          detalle_pedido: tempItems, 
          total: finalTotal, 
          estado: 'Surtido' 
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // Generar Mensaje de Confirmación Real
      let msg = `*PEDIDO SURTIDO - AMOREE* ✅\n--------------------------\n`;
      msg += `👤 CLIENTE: ${selectedOrder.nombre_cliente}\n`;
      msg += `💰 *TOTAL FINAL REAL: ${formatCurrency(finalTotal)}*\n--------------------------\n`;
      tempItems.forEach(i => {
        msg += `• ${i.quantity}${i.unidad || 'kg'} x ${i.nombre} = ${formatCurrency(i.quantity * i.precio_venta)}\n`;
      });
      msg += `--------------------------\n`;
      msg += `Tu pedido ha sido pesado y surtido. ¡Ya vamos en camino o puedes pasar por él! 🚚💨`;

      sendWA(selectedOrder.telefono_cliente, msg);
      setIsWeighing(false);
      fetchData();
    } catch (e) { alert("Error al surtir."); }
  };

  const updateStatus = async (id: number, status: string) => {
    await supabase.from('pedidos').update({ estado: status }).eq('id', id);
    fetchData();
  };

  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') filtered = filtered.filter(o => o.origen !== 'Mostrador');
    else if (orderTab === 'terminal') filtered = filtered.filter(o => o.origen === 'Mostrador');
    if (searchTerm) filtered = filtered.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return filtered;
  };

  // ... (Aquí iría la lógica de Corte de Caja que ya tienes)

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* HEADER DE NAVEGACIÓN (Business OS) */}
      <div className="bg-black/90 p-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-center sticky top-0 z-[100] backdrop-blur-xl gap-4">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
          {[
            { id: 'orders', label: 'Pedidos', icon: <ShoppingBag size={14}/> },
            { id: 'pos', label: 'Terminal', icon: <Calculator size={14}/> },
            { id: 'inventory', label: 'Almacén', icon: <Package size={14}/> },
            { id: 'recibo', label: 'Recibo', icon: <Truck size={14}/> },
            { id: 'clients', label: 'Cartera', icon: <Users size={14}/> },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${view === v.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'orders' ? (
          <>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
              </div>
              <div className="flex-1 w-full relative">
                 <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                 <input type="text" placeholder="BUSCAR PEDIDO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/5 rounded-[22px] py-4 pl-16 pr-8 text-[10px] font-black uppercase outline-none focus:border-green-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {getFilteredOrders().map(order => (
                <div key={order.id} className={`bg-[#0A0A0A] border rounded-[40px] p-8 transition-all ${order.estado === 'Finalizado' ? 'opacity-40 grayscale' : 'border-white/10 shadow-2xl hover:border-green-500/30'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full mb-2 inline-block ${order.estado === 'Pendiente' ? 'bg-amber-500 text-black' : 'bg-green-600 text-white'}`}>{order.estado}</span>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente}</h3>
                      <p className="text-[9px] text-gray-600 font-black mt-1 uppercase tracking-widest">{format(new Date(order.created_at), 'HH:mm')} hrs</p>
                    </div>
                    <p className="text-2xl font-black text-green-500">{formatCurrency(order.total)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <span key={idx} className="text-[8px] font-black uppercase bg-white/[0.05] px-3 py-1.5 rounded-lg text-gray-400">
                        {item.quantity}{item.unidad || 'kg'} {item.nombre}
                      </span>
                    ))}
                  </div>

                  {/* ✅ BOTONES DE ACCIÓN (Corazón del Surtido) */}
                  <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/5">
                    {order.estado === 'Pendiente' && (
                      <button onClick={() => openWeighing(order)} className="col-span-2 bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                        <Scale size={16}/> Surtir y Pesar Pedido
                      </button>
                    )}
                    {order.estado === 'Surtido' && (
                      <button onClick={() => updateStatus(order.id, 'Finalizado')} className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                        <CheckCircle2 size={16}/> Marcar como Finalizado
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Resto de las vistas: Inventory, Recibo, POS, etc. */
          <div className="p-10 text-center">Módulo {view} en desarrollo...</div>
        )}
      </div>

      {/* ✅ MODAL DE BÁSCULA TITANIUM */}
      {isWeighing && selectedOrder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-2xl shadow-3xl">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-green-500">Ajuste de Báscula</h2>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">Surtido para: {selectedOrder.nombre_cliente}</p>
              </div>
              <button onClick={() => setIsWeighing(false)} className="bg-white/5 p-3 rounded-full hover:bg-red-500 transition-all"><X size={24}/></button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4 mb-10 no-scrollbar">
              {tempItems.map((item, idx) => (
                <div key={idx} className="bg-white/[0.03] border border-white/5 p-6 rounded-[30px] flex justify-between items-center">
                  <div className="flex-1">
                    <p className="text-[11px] font-black uppercase text-white">{item.nombre}</p>
                    <p className="text-[8px] font-bold text-gray-500 uppercase">Precio: {formatCurrency(item.precio_venta)} / {item.unidad || 'kg'}</p>
                  </div>
                  <div className="flex items-center gap-4 bg-black p-2 rounded-2xl border border-white/5">
                    <input 
                      type="number" 
                      step={item.unidad === 'pza' ? 1 : 0.05}
                      value={item.quantity} 
                      onChange={(e) => handleWeightChange(idx, parseFloat(e.target.value) || 0)}
                      className="bg-transparent w-24 text-center text-xl font-black text-green-500 outline-none"
                    />
                    <span className="text-[10px] font-black text-gray-500 uppercase mr-2">{item.unidad || 'kg'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Real Actualizado</p>
                <p className="text-4xl font-black italic tracking-tighter text-white">{formatCurrency(calculateTempTotal())}</p>
              </div>
              <button onClick={saveAndNotify} className="w-full md:w-auto bg-green-600 hover:bg-green-500 text-white px-12 py-5 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
                <Send size={18}/> Guardar y Enviar Total
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
