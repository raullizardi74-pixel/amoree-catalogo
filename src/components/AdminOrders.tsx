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
import { Scanner } from './Scanner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { 
  Package, LayoutDashboard, ShoppingBag, Users, 
  BarChart3, Truck, Calculator, X, Clock, ShieldCheck, ArrowRight
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [comprasHoy, setComprasHoy] = useState<any[]>([]); // ✅ Nuevo: Para traer los recibos
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo' | 'auditoria'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ ESTADOS PARA EL CORTE DE CAJA INTEGRADO
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);
  const [fondoCaja, setFondoCaja] = useState(1500); 
  const [otrosGastos, setOtrosGastos] = useState(0); // Para gastos manuales no registrados
  const [efectivoFisico, setEfectivoFisico] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    const hoyInicio = startOfDay(new Date()).toISOString();
    const hoyFin = endOfDay(new Date()).toISOString();

    // Traer Pedidos
    const { data: p } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    // Traer Compras/Recibos del día para el Corte
    const { data: c } = await supabase.from('compras')
      .select('*, proveedores(nombre)')
      .gte('created_at', hoyInicio)
      .lte('created_at', hoyFin);

    if (p) setOrders(p);
    if (c) setComprasHoy(c);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }
  };

  const discountStock = async (items: any[]) => {
    for (const item of items) {
      const { data: product } = await supabase.from('productos').select('stock_actual').eq('sku', item.sku || item.SKU).single();
      if (product) {
        const nuevoStock = product.stock_actual - item.quantity;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('sku', item.sku || item.SKU);
      }
    }
  };

  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
    if (!error) {
      await discountStock(order.detalle_pedido);
      fetchData();
    }
  };

  // ✅ CORTE DE CAJA INTELIGENTE (PUNTO 1 Y 2)
  const prepararCorte = () => {
    const hoyStr = new Date().toLocaleDateString();
    const ventasEfectivoHoy = orders.filter(o => 
      new Date(o.created_at).toLocaleDateString() === hoyStr && 
      o.estado === 'Finalizado' &&
      (o.metodo_pago === 'Efectivo' || !o.metodo_pago)
    ).reduce((acc, o) => acc + o.total, 0);

    const ventasTotales = orders.filter(o => 
      new Date(o.created_at).toLocaleDateString() === hoyStr && o.estado === 'Finalizado'
    );

    // Sumar todos los recibos registrados hoy
    const totalRecibos = comprasHoy.reduce((acc, curr) => acc + Number(curr.total), 0);

    const esperado = fondoCaja + ventasEfectivoHoy - totalRecibos - otrosGastos;

    setCorteSummary({ 
      ventasEfectivo: ventasEfectivoHoy,
      totalRecibos: totalRecibos,
      esperado: esperado,
      detallesRecibos: comprasHoy,
      cantidadVentas: ventasTotales.length
    });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const fecha = format(new Date(), 'dd/MM/yyyy HH:mm');
    const dif = efectivoFisico - corteSummary.esperado;
    
    let msg = `*AMOREE - REPORTE DE CIERRE* 🏦\n`;
    msg += `*Fecha:* ${fecha}\n`;
    msg += `--------------------------\n`;
    msg += `💰 Fondo Inicial: *${formatCurrency(fondoCaja)}*\n`;
    msg += `💵 Ventas Efectivo: *${formatCurrency(corteSummary.ventasEfectivo)}*\n`;
    msg += `🚚 Pagos Proveedores: *-${formatCurrency(corteSummary.totalRecibos)}*\n`;
    if(otrosGastos > 0) msg += `📝 Otros Gastos: *-${formatCurrency(otrosGastos)}*\n`;
    msg += `--------------------------\n`;
    msg += `🎯 *EFECTIVO ESPERADO: ${formatCurrency(corteSummary.esperado)}*\n`;
    msg += `✋ *EFECTIVO FÍSICO: ${formatCurrency(efectivoFisico)}*\n`;
    msg += `--------------------------\n`;
    msg += dif < 0 ? `⚠️ FALTANTE: *${formatCurrency(dif)}*` : dif > 0 ? `✅ SOBRANTE: *${formatCurrency(dif)}*` : `💎 CAJA CUADRADA`;
    
    sendWA("52XXXXXXXXXX", msg); 
    setShowCorteModal(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* NAVEGACIÓN */}
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
              <button onClick={prepararCorte} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Calculator size={16}/> Corte de Caja
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {orders.filter(o => (orderTab === 'terminal' ? o.origen === 'Mostrador' : o.origen !== 'Mostrador')).map(order => (
                <div key={order.id} className={`bg-[#0A0A0A] border rounded-[50px] p-10 transition-all ${order.estado === 'Finalizado' ? 'border-white/5 opacity-50' : 'border-white/10 shadow-2xl'}`}>
                  {/* ... Tarjeta simplificada para brevedad en este prompt ... */}
                  <h3 className="text-xl font-black uppercase italic">{order.nombre_cliente} - {formatCurrency(order.total)}</h3>
                  <p className="text-[10px] text-gray-600 uppercase mt-2">{order.metodo_pago || 'Efectivo'}</p>
                </div>
              ))}
            </div>
          </>
        ) : view === 'inventory' ? (
          <InventoryModule onBack={() => setView('orders')} />
        ) : view === 'recibo' ? (
          <ReciboModule onBack={() => setView('orders')} />
        ) : view === 'ruta' ? (
          <RutaDeCompra onBack={() => setView('orders')} />
        ) : view === 'pos' ? (
          <POS onBack={() => setView('orders')} />
        ) : view === 'stats' ? (
          <Dashboard />
        ) : view === 'auditoria' ? (
          <AuditoriaModule onBack={() => setView('orders')} />
        ) : (
          <ClientsModule />
        )}
      </div>

      {/* ✅ MODAL DE CORTE DE CAJA INTEGRADO (EL DE ENVIDIA) */}
      {showCorteModal && corteSummary && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-4xl relative shadow-2xl flex flex-col md:flex-row gap-8">
            <button onClick={() => setShowCorteModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X/></button>
            
            {/* COLUMNA IZQUIERDA: CAPTURA */}
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-black uppercase italic text-blue-500 mb-8">Corte Maestro</h2>
              
              <div className="bg-black/50 p-6 rounded-3xl border border-white/5">
                <label className="text-[8px] font-black text-gray-500 uppercase block mb-2">Fondo de Caja (Efectivo inicial)</label>
                <input type="number" value={fondoCaja} onChange={(e) => setFondoCaja(Number(e.target.value))} className="bg-transparent text-2xl font-black text-white outline-none w-full" />
              </div>

              <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                <p className="text-[8px] font-black text-gray-500 uppercase mb-4 tracking-widest">Pagos Detectados en "Recibo" (Automático)</p>
                <div className="space-y-3 max-h-40 overflow-y-auto no-scrollbar">
                  {corteSummary.detallesRecibos.map((r: any) => (
                    <div key={r.id} className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="text-gray-500">🚚 {r.proveedores?.nombre || 'Proveedor'}</span>
                      <span className="text-red-500">-{formatCurrency(r.total)}</span>
                    </div>
                  ))}
                  {corteSummary.detallesRecibos.length === 0 && <p className="text-[10px] text-gray-700 italic">No hay pagos registrados hoy</p>}
                </div>
              </div>

              <div className="bg-red-600/5 p-6 rounded-3xl border border-red-500/20">
                <label className="text-[8px] font-black text-red-500 uppercase block mb-2">Otros Gastos (Manuales / Sin Recibo)</label>
                <input type="number" value={otrosGastos} onChange={(e) => setOtrosGastos(Number(e.target.value))} className="bg-transparent text-2xl font-black text-red-500 outline-none w-full" placeholder="$0.00" />
              </div>

              <div className="bg-green-600/5 p-6 rounded-3xl border border-green-500/20">
                <label className="text-[8px] font-black text-green-500 uppercase block mb-2">Efectivo Físico en Caja (Contado)</label>
                <input type="number" value={efectivoFisico} onChange={(e) => setEfectivoFisico(Number(e.target.value))} className="bg-transparent text-4xl font-black text-green-500 outline-none w-full" placeholder="$0.00" />
              </div>
            </div>

            {/* COLUMNA DERECHA: RESULTADOS */}
            <div className="w-full md:w-[320px] bg-white/[0.03] border border-white/5 rounded-[45px] p-10 flex flex-col justify-center text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Efectivo Esperado</p>
              <p className="text-3xl font-black mb-10">{formatCurrency(corteSummary.esperado)}</p>
              
              <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Diferencia Final</p>
              <p className={`text-5xl font-black italic tracking-tighter ${efectivoFisico - corteSummary.esperado < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {formatCurrency(efectivoFisico - corteSummary.esperado)}
              </p>
              <p className="text-[8px] text-gray-600 uppercase font-black mt-4">
                {efectivoFisico - corteSummary.esperado === 0 ? '💎 Caja Cuadrada' : '⚠️ Revisar movimientos'}
              </p>

              <button onClick={enviarCorteWA} className="mt-12 w-full bg-white text-black py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-xl">
                Cerrar Día y Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
