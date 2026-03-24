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
  Package, LayoutDashboard, ShoppingBag, Users, 
  BarChart3, Truck, Calculator, X, Clock, ShieldCheck, Search
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [comprasHoy, setComprasHoy] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo' | 'auditoria'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ESTADOS DEL CORTE MAESTRO
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);
  const [fondoCaja, setFondoCaja] = useState(1500); 
  const [otrosGastos, setOtrosGastos] = useState(0); 
  const [efectivoFisico, setEfectivoFisico] = useState(0);

  // 🛡️ MAGIA TITANIUM: Cálculo de rango de fecha en horario México (UTC-6)
  const getMexicoTimeRange = () => {
    // Obtenemos la fecha actual en formato YYYY-MM-DD para México
    const hoyMX = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    // Creamos el inicio y fin del día forzando el desfase de México (-06:00)
    // Esto asegura que Supabase reciba el UTC correcto sin importar dónde esté el servidor
    const inicio = `${hoyMX}T00:00:00-06:00`;
    const fin = `${hoyMX}T23:59:59-06:00`;

    return { inicio, fin };
  };

  const fetchData = async () => {
    setLoading(true);
    const { inicio, fin } = getMexicoTimeRange();

    // 1. Pedidos: Solo los de HOY (Global)
    const { data: p } = await supabase.from('pedidos')
      .select('*')
      .gte('created_at', inicio)
      .lte('created_at', fin)
      .order('created_at', { ascending: false });

    // 2. Compras/Recibos: Solo los de HOY para el Corte (FEMSA, Central, etc.)
    const { data: c } = await supabase.from('compras')
      .select('*, proveedores(nombre)')
      .gte('created_at', inicio)
      .lte('created_at', fin);

    if (p) setOrders(p);
    if (c) setComprasHoy(c || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [view]);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }
  };

  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
    if (!error) {
      // Descontar stock (lógica simplificada para este bloque)
      fetchData();
    }
  };

  const prepararCorte = () => {
    // Ventas Finalizadas en Efectivo de Hoy
    const ventasEfectivoHoy = orders.filter(o => 
      o.estado === 'Finalizado' && (o.metodo_pago === 'Efectivo' || !o.metodo_pago)
    ).reduce((acc, o) => acc + o.total, 0);

    // Sumamos Compras/Recibos de Hoy (Cualquier columna que tenga el total)
    const totalRecibos = comprasHoy.reduce((acc, curr) => acc + (Number(curr.total) || Number(curr.total_compra) || 0), 0);
    
    // El Efectivo que DEBE haber en caja
    const esperado = fondoCaja + ventasEfectivoHoy - totalRecibos - otrosGastos;

    setCorteSummary({ 
      ventasEfectivo: ventasEfectivoHoy,
      totalRecibos: totalRecibos,
      esperado: esperado,
      detallesRecibos: comprasHoy
    });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const fecha = format(new Date(), 'dd/MM/yyyy HH:mm');
    const dif = efectivoFisico - corteSummary.esperado;
    let msg = `*AMOREE - CORTE MAESTRO* 🏦\n*Fecha:* ${fecha}\n--------------------------\n`;
    msg += `💰 Fondo Inicial: *${formatCurrency(fondoCaja)}*\n💵 Ventas Efectivo: *${formatCurrency(corteSummary.ventasEfectivo)}*\n🚚 Pagos Recibos: *-${formatCurrency(corteSummary.totalRecibos)}*\n`;
    if(otrosGastos > 0) msg += `📝 Otros Gastos: *-${formatCurrency(otrosGastos)}*\n`;
    msg += `--------------------------\n🎯 *ESPERADO: ${formatCurrency(corteSummary.esperado)}*\n✋ *FÍSICO: ${formatCurrency(efectivoFisico)}*\n`;
    msg += `--------------------------\n`;
    msg += dif < 0 ? `⚠️ FALTANTE: *${formatCurrency(dif)}*` : dif > 0 ? `✅ SOBRANTE: *${formatCurrency(dif)}*` : `💎 CAJA CUADRADA`;
    
    sendWA("52XXXXXXXXXX", msg); // Número de Hugo
    setShowCorteModal(false);
  };

  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') filtered = filtered.filter(o => o.origen !== 'Mostrador');
    else if (orderTab === 'terminal') filtered = filtered.filter(o => o.origen === 'Mostrador');
    if (searchTerm) filtered = filtered.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return filtered;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
              <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-full md:w-auto">
                <button onClick={() => setOrderTab('whatsapp')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'whatsapp' ? 'bg-green-600' : 'text-gray-500'}`}>🛵 WhatsApp</button>
                <button onClick={() => setOrderTab('terminal')} className={`flex-1 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase ${orderTab === 'terminal' ? 'bg-white text-black' : 'text-gray-500'}`}>🏪 Terminal</button>
              </div>
              <div className="flex-1 w-full relative">
                 <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                 <input type="text" placeholder="BUSCAR EN HOY..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#0A0A0A] border border-white/5 rounded-[22px] py-4 pl-16 pr-8 text-[10px] font-black uppercase outline-none focus:border-green-500" />
              </div>
              <button onClick={prepararCorte} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Calculator size={16}/> Corte de Caja
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 opacity-50 font-black uppercase tracking-widest text-xs">Cargando datos de hoy...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {getFilteredOrders().map(order => (
                  <div key={order.id} className={`bg-[#0A0A0A] border rounded-[50px] p-10 transition-all ${order.estado === 'Finalizado' ? 'border-white/5 opacity-50' : 'border-white/10 shadow-2xl'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente}</h3>
                        <p className="text-[9px] text-gray-600 font-black mt-1 uppercase tracking-widest">{format(new Date(order.created_at), 'HH:mm')} hrs</p>
                      </div>
                      <p className="text-2xl font-black text-white">{formatCurrency(order.total)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                      {order.detalle_pedido?.map((item: any, idx: number) => (
                        <span key={idx} className="text-[7px] font-black uppercase bg-white/[0.03] px-2 py-1 rounded-md text-gray-500">{item.quantity}{item.unidad || 'kg'} {item.nombre}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {getFilteredOrders().length === 0 && (
                  <div className="col-span-full text-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-[50px]">
                    <p className="text-[10px] font-black text-gray-700 uppercase tracking-[0.3em]">No hay actividad registrada el día de hoy</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : view === 'inventory' ? <InventoryModule onBack={() => setView('orders')} /> 
          : view === 'recibo' ? <ReciboModule onBack={() => setView('orders')} />
          : view === 'ruta' ? <RutaDeCompra onBack={() => setView('orders')} />
          : view === 'pos' ? <POS onBack={() => setView('orders')} />
          : view === 'stats' ? <Dashboard />
          : view === 'auditoria' ? <AuditoriaModule onBack={() => setView('orders')} />
          : <ClientsModule />}
      </div>

      {/* MODAL CORTE DE CAJA: VERSIÓN RESPONSIVE CELULAR CON SCROLL */}
      {showCorteModal && corteSummary && (
        <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center p-2 md:p-4 bg-black/95 backdrop-blur-xl overflow-y-auto no-scrollbar">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] md:rounded-[60px] p-6 md:p-10 w-full max-w-4xl relative shadow-2xl flex flex-col md:flex-row gap-8 my-auto">
            <button onClick={() => setShowCorteModal(false)} className="absolute top-6 right-6 md:top-10 md:right-10 text-gray-500 hover:text-white z-10"><X/></button>
            
            <div className="flex-1 space-y-4 md:space-y-6">
              <h2 className="text-2xl md:text-3xl font-black uppercase italic text-blue-500 mb-4 md:mb-8 text-center md:text-left">Corte Maestro</h2>
              
              <div className="bg-black/50 p-4 md:p-6 rounded-3xl border border-white/5">
                <label className="text-[8px] font-black text-gray-500 uppercase block mb-2">Fondo de Caja (Inicio)</label>
                <input type="number" value={fondoCaja} onChange={(e) => setFondoCaja(Number(e.target.value))} className="bg-transparent text-xl font-black text-white outline-none w-full" />
              </div>

              <div className="bg-white/[0.02] p-4 md:p-6 rounded-3xl border border-white/5">
                <p className="text-[8px] font-black text-gray-500 uppercase mb-4 tracking-widest italic">Recibos Detectados Hoy</p>
                <div className="space-y-3 max-h-32 overflow-y-auto no-scrollbar">
                  {corteSummary.detallesRecibos.map((r: any) => (
                    <div key={r.id} className="flex justify-between items-center text-[10px] font-black uppercase border-b border-white/5 pb-2">
                      <span className="text-gray-500 truncate mr-2">🚚 {r.proveedores?.nombre || r.proveedor || 'Proveedor'}</span>
                      <span className="text-red-500 shrink-0">-{formatCurrency(r.total || r.total_compra)}</span>
                    </div>
                  ))}
                  {corteSummary.detallesRecibos.length === 0 && <p className="text-[9px] text-gray-700 italic">No hay actividad de proveedores hoy</p>}
                </div>
              </div>

              <div className="bg-red-600/5 p-4 md:p-6 rounded-3xl border border-red-500/20">
                <label className="text-[8px] font-black text-red-500 uppercase block mb-2">Gastos Manuales (Sin Recibo)</label>
                <input type="number" value={otrosGastos} onChange={(e) => setOtrosGastos(Number(e.target.value))} className="bg-transparent text-xl font-black text-red-500 outline-none w-full" placeholder="$0.00" />
              </div>

              <div className="bg-green-600/5 p-4 md:p-6 rounded-3xl border border-green-500/20">
                <label className="text-[8px] font-black text-green-500 uppercase block mb-2">Efectivo Físico en Cajón</label>
                <input type="number" value={efectivoFisico} onChange={(e) => setEfectivoFisico(Number(e.target.value))} className="bg-transparent text-2xl md:text-4xl font-black text-green-500 outline-none w-full" placeholder="$0.00" />
              </div>
            </div>

            <div className="w-full md:w-[320px] bg-white/[0.03] border border-white/5 rounded-[45px] p-8 md:p-10 flex flex-col justify-center text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Efectivo Esperado</p>
              <p className="text-2xl md:text-3xl font-black mb-6 md:mb-10">{formatCurrency(corteSummary.esperado)}</p>
              
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Diferencia Final</p>
              <p className={`text-4xl md:text-5xl font-black italic tracking-tighter ${efectivoFisico - corteSummary.esperado < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {formatCurrency(efectivoFisico - corteSummary.esperado)}
              </p>
              
              <button onClick={enviarCorteWA} className="mt-8 md:mt-12 w-full bg-white text-black py-5 md:py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-xl">
                Cerrar Día y Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
