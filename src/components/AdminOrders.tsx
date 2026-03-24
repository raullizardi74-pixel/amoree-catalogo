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
import { format } from 'date-fns';
import { 
  Package, LayoutDashboard, ShoppingBag, Users, 
  BarChart3, Truck, Calculator, X, Clock, ShieldCheck 
} from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo' | 'auditoria'>('orders');
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ ESTADOS PARA EL CORTE DE CAJA DE ENVIDIA
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);
  const [fondoCaja, setFondoCaja] = useState(1500); // Fondo inicial sugerido
  const [gastosProveedores, setGastosProveedores] = useState(0);
  const [efectivoFisico, setEfectivoFisico] = useState(0);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }
  };

  const discountStock = async (items: any[]) => {
    for (const item of items) {
      const { data: product } = await supabase
        .from('productos')
        .select('stock_actual')
        .eq('sku', item.sku || item.SKU)
        .single();

      if (product) {
        const nuevoStock = product.stock_actual - item.quantity;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('sku', item.sku || item.SKU);
      }
    }
  };

  const handleConfirmWeights = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ 
      estado: 'Pendiente de Pago',
      detalle_pedido: order.detalle_pedido,
      total: order.total 
    }).eq('id', order.id);

    if (!error) {
      const msg = `*AMOREE - Pesos Confirmados* 🥑\n\n¡Hola! Ya pesamos tu pedido:\n` +
                  order.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('\n') +
                  `\n\n*TOTAL FINAL: ${formatCurrency(order.total)}*\n\nFavor de enviar comprobante. 🚀`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleRegisterPayment = async (order: any, metodo: string) => {
    if (metodo === 'A Cuenta') {
      const { data: client } = await supabase.from('clientes').select('*').eq('telefono', order.telefono_cliente).single();
      if (client) {
        await supabase.from('clientes').update({ saldo_deudor: (client.saldo_deudor || 0) + order.total }).eq('id', client.id);
      } else {
        await supabase.from('clientes').insert([{ nombre: order.nombre_cliente.toUpperCase(), telefono: order.telefono_cliente, saldo_deudor: order.total }]);
      }
    }

    const { error } = await supabase.from('pedidos').update({ estado: 'Pagado - Por Entregar', metodo_pago: metodo }).eq('id', order.id);
    if (!error) {
      const msg = metodo === 'A Cuenta' 
        ? `*AMOREE - Crédito Registrado* 📑\n\nPedido por *${formatCurrency(order.total)}* registrado A CUENTA.\n\nEntrega PROGRAMADA. 🛵`
        : `*AMOREE - Pago Recibido* ✅\n\nConfirmamos pago por *${formatCurrency(order.total)}* vía *${metodo}*.\n\nEntrega PROGRAMADA. 🛵`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
    if (!error) {
      await discountStock(order.detalle_pedido);
      const msg = `*AMOREE - Pedido Entregado* 📦\n\n¡Tu pedido ha llegado! Gracias por tu confianza. 🥑✨`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  // ✅ FUNCIÓN CORTE DE CAJA MEJORADA
  const prepararCorte = () => {
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = orders.filter(o => 
      new Date(o.created_at).toLocaleDateString() === hoy && 
      o.estado !== 'Cancelado'
    );

    const resumen = ventasHoy.reduce((acc, o) => {
      const metodo = o.metodo_pago || 'Efectivo';
      acc[metodo] = (acc[metodo] || 0) + o.total;
      acc['TotalVentas'] = (acc['TotalVentas'] || 0) + o.total;
      return acc;
    }, { 'Efectivo': 0, 'Transferencia': 0, 'Terminal': 0, 'A Cuenta': 0, 'TotalVentas': 0 } as any);

    // Efectivo Esperado = Fondo + Ventas Efectivo - Gastos
    const esperado = fondoCaja + resumen['Efectivo'] - gastosProveedores;

    setCorteSummary({ 
      ...resumen, 
      cantidad: ventasHoy.length,
      esperado: esperado
    });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const fecha = format(new Date(), 'dd/MM/yyyy HH:mm');
    const dif = efectivoFisico - corteSummary.esperado;
    
    let msg = `*AMOREE - CORTE DE CAJA* 🏦\n`;
    msg += `*Fecha:* ${fecha}\n`;
    msg += `--------------------------\n`;
    msg += `💰 Fondo Inicial: *${formatCurrency(fondoCaja)}*\n`;
    msg += `💵 Ventas Efectivo: *${formatCurrency(corteSummary.Efectivo)}*\n`;
    msg += `💸 Pagos Locales: *-${formatCurrency(gastosProveedores)}*\n`;
    msg += `--------------------------\n`;
    msg += `🎯 *EFECTIVO ESPERADO: ${formatCurrency(corteSummary.esperado)}*\n`;
    msg += `✋ *EFECTIVO FÍSICO: ${formatCurrency(efectivoFisico)}*\n`;
    
    if (dif !== 0) {
      msg += `${dif < 0 ? '⚠️ FALTANTE:' : '✅ SOBRANTE:'} *${formatCurrency(dif)}*\n`;
    } else {
      msg += `💎 *CAJA CUADRADA PERFECTA*\n`;
    }

    msg += `--------------------------\n`;
    msg += `💳 Terminal: ${formatCurrency(corteSummary.Terminal || 0)}\n`;
    msg += `🏦 Transf: ${formatCurrency(corteSummary.Transferencia || 0)}\n`;
    msg += `📑 A Cuenta: ${formatCurrency(corteSummary['A Cuenta'] || 0)}\n`;
    msg += `🚀 *Total Ventas: ${formatCurrency(corteSummary.TotalVentas)}*\n\n`;
    msg += `*Automatiza con Raul*`;

    sendWA("52XXXXXXXXXX", msg); // Reemplazar con el número de Hugo
    setShowCorteModal(false);
  };

  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') filtered = filtered.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO'));
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
            <button 
              key={v.id} 
              onClick={() => setView(v.id as any)} 
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${view === v.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
            >
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
              {getFilteredOrders().map(order => (
                <div key={order.id} className={`bg-[#0A0A0A] border rounded-[50px] p-10 transition-all ${order.estado === 'Finalizado' ? 'border-white/5 opacity-70' : 'border-white/10 shadow-2xl'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase inline-block ${order.estado === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-500' : order.estado === 'Pendiente de Pago' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}`}>
                          {order.estado}
                        </span>
                        <span className="text-[8px] font-black px-3 py-1 rounded-full uppercase bg-white/5 text-gray-400">
                          {order.metodo_pago || 'Efectivo'}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tighter">{order.nombre_cliente}</h3>
                      <p className="text-[9px] text-gray-600 font-black mt-1 uppercase tracking-widest">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {order.telefono_cliente}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white">{formatCurrency(order.total)}</p>
                      <p className="text-[8px] text-gray-700 font-bold uppercase mt-1">ID: #{order.id.toString().slice(-4)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6 pt-4 border-t border-white/5">
                    {order.detalle_pedido?.map((item: any, idx: number) => (
                      <span key={idx} className="text-[7px] font-black uppercase bg-white/[0.03] px-2 py-1 rounded-md text-gray-500 border border-white/5">
                        {item.quantity}{item.unidad || 'kg'} {item.nombre}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-4 border-t border-white/5 pt-8">
                    {order.estado === 'Pendiente' && <button onClick={() => handleConfirmWeights(order)} className="bg-green-600 text-white w-full py-5 rounded-2xl font-black uppercase">⚖️ Confirmar Pesos</button>}
                    {order.estado === 'Pendiente de Pago' && (
                      <div className="grid grid-cols-2 gap-3">
                        {['Efectivo', 'Transferencia', 'Terminal', 'A Cuenta'].map(m => (
                          <button key={m} onClick={() => handleRegisterPayment(order, m)} className="bg-white/5 border border-white/10 py-4 rounded-xl text-[9px] font-black uppercase hover:bg-white hover:text-black transition-colors">{m}</button>
                        ))}
                      </div>
                    )}
                    {order.estado === 'Pagado - Por Entregar' && <button onClick={() => handleDeliver(order)} className="bg-white text-black w-full py-5 rounded-2xl font-black uppercase">📦 Marcar Entregado</button>}
                  </div>
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

      {/* ✅ MODAL CORTE DE CAJA DE ENVIDIA */}
      {showCorteModal && corteSummary && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in zoom-in-95 duration-300">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-2xl relative shadow-2xl">
            <button onClick={() => setShowCorteModal(false)} className="absolute top-10 right-10 text-gray-500 hover:text-white"><X/></button>
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black uppercase italic text-blue-500">Corte de Caja</h2>
              <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em] mt-1 italic">Validación de Flujo Físico</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="space-y-4">
                <div className="bg-black/50 p-4 rounded-3xl border border-white/5">
                  <label className="text-[8px] font-black text-gray-500 uppercase block mb-2">Fondo de Caja (Inicio)</label>
                  <input type="number" value={fondoCaja} onChange={(e) => setFondoCaja(Number(e.target.value))} className="bg-transparent text-xl font-black text-white outline-none w-full" />
                </div>
                <div className="bg-red-600/5 p-4 rounded-3xl border border-red-500/20">
                  <label className="text-[8px] font-black text-red-500 uppercase block mb-2">Pagos Locales (Salida)</label>
                  <input type="number" value={gastosProveedores} onChange={(e) => setGastosProveedores(Number(e.target.value))} className="bg-transparent text-xl font-black text-red-500 outline-none w-full" placeholder="$0.00" />
                </div>
                <div className="bg-green-600/5 p-4 rounded-3xl border border-green-500/20">
                  <label className="text-[8px] font-black text-green-500 uppercase block mb-2">Efectivo Físico (Contado)</label>
                  <input type="number" value={efectivoFisico} onChange={(e) => setEfectivoFisico(Number(e.target.value))} className="bg-transparent text-2xl font-black text-green-500 outline-none w-full" placeholder="$0.00" />
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 flex flex-col justify-center">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Efectivo Esperado</p>
                <p className="text-2xl font-black mb-6">{formatCurrency(fondoCaja + corteSummary.Efectivo - gastosProveedores)}</p>
                
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Diferencia</p>
                <p className={`text-4xl font-black italic tracking-tighter ${efectivoFisico - (fondoCaja + corteSummary.Efectivo - gastosProveedores) < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {formatCurrency(efectivoFisico - (fondoCaja + corteSummary.Efectivo - gastosProveedores))}
                </p>
                <p className="text-[7px] text-gray-600 uppercase font-black mt-2">
                  {efectivoFisico - (fondoCaja + corteSummary.Efectivo - gastosProveedores) === 0 ? '💎 Caja Cuadrada' : '⚠️ Revisar transacciones'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
               <div className="p-4 bg-black rounded-2xl border border-white/5 text-center">
                  <p className="text-[7px] text-gray-500 uppercase font-black">Ventas Tarjeta</p>
                  <p className="text-sm font-black text-blue-400">{formatCurrency(corteSummary.Terminal || 0)}</p>
               </div>
               <div className="p-4 bg-black rounded-2xl border border-white/5 text-center">
                  <p className="text-[7px] text-gray-500 uppercase font-black">Transferencias</p>
                  <p className="text-sm font-black text-purple-400">{formatCurrency(corteSummary.Transferencia || 0)}</p>
               </div>
            </div>

            <button onClick={enviarCorteWA} className="w-full bg-white text-black py-6 rounded-[30px] font-black uppercase tracking-[0.3em] text-[11px] active:scale-95 transition-all shadow-2xl">
              Confirmar y Enviar Reporte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
