import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from 'date-fns';

interface ProductStats {
  nombre: string;
  cantidad: number;
  ventaTotal: number;
  costoTotal: number;
  utilidad: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7');
  const [customRange, setCustomRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [stats, setStats] = useState({
    ventaTotal: 0,
    costoTotal: 0,
    utilidad: 0,
    numPedidos: 0,
    ventaApp: 0,
    ventaMostrador: 0,
    ticketPromedio: 0,
    margenPorcentaje: 0
  });

  const [topProducts, setTopProducts] = useState<ProductStats[]>([]);

  useEffect(() => {
    fetchData();
  }, [periodo, customRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['Pagado - Por Entregar', 'Finalizado', 'Pagado']);

      if (error) throw error;

      let inicio: Date, fin: Date;
      if (periodo === 'custom') {
        inicio = startOfDay(new Date(customRange.start));
        fin = endOfDay(new Date(customRange.end));
      } else {
        inicio = startOfDay(subDays(new Date(), parseInt(periodo)));
        fin = endOfDay(new Date());
      }

      const pedidosFiltrados = pedidos.filter(p => 
        isWithinInterval(new Date(p.created_at), { start: inicio, end: fin })
      );

      let v = 0, c = 0, n = 0, vApp = 0, vMostrador = 0;
      const productMap = new Map<string, ProductStats>();

      pedidosFiltrados.forEach(p => {
        v += p.total;
        n++;
        if (p.origen === 'Mostrador') vMostrador += p.total; else vApp += p.total;

        p.detalle_pedido?.forEach((item: any) => {
          const costoUnitario = item.costo || 0;
          const itemCostoTotal = costoUnitario * item.quantity;
          const itemVentaTotal = item.precio_venta * item.quantity;
          c += itemCostoTotal;

          const current = productMap.get(item.nombre) || { 
            nombre: item.nombre, cantidad: 0, ventaTotal: 0, costoTotal: 0, utilidad: 0 
          };
          current.cantidad += item.quantity;
          current.ventaTotal += itemVentaTotal;
          current.costoTotal += itemCostoTotal;
          current.utilidad += (itemVentaTotal - itemCostoTotal);
          productMap.set(item.nombre, current);
        });
      });

      setStats({
        ventaTotal: v,
        costoTotal: c,
        utilidad: v - c,
        numPedidos: n,
        ventaApp: vApp,
        ventaMostrador: vMostrador,
        ticketPromedio: n > 0 ? v / n : 0,
        margenPorcentaje: v > 0 ? ((v - c) / v) * 100 : 0
      });

      setTopProducts(Array.from(productMap.values()).sort((a, b) => b.utilidad - a.utilidad).slice(0, 5));

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen pb-32">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER LIMPIO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
              Business <span className="text-green-600">Intelligence</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sincronización activa con Supabase</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 w-full md:w-auto">
              {[{l:'Hoy',v:'0'},{l:'7D',v:'7'},{l:'30D',v:'30'},{l:'📅',v:'custom'}].map((btn) => (
                <button
                  key={btn.v} onClick={() => setPeriodo(btn.v)}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${periodo === btn.v ? 'bg-gray-900 text-white shadow-xl scale-105' : 'text-gray-400 hover:text-gray-900'}`}
                >
                  {btn.l}
                </button>
              ))}
            </div>
            
            {periodo === 'custom' && (
              <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                <input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="text-[10px] font-black p-3 rounded-xl border-0 shadow-sm bg-white outline-none focus:ring-2 focus:ring-green-400" />
                <input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="text-[10px] font-black p-3 rounded-xl border-0 shadow-sm bg-white outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            )}
          </div>
        </div>

        {/* METRICAS DE PODER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 group hover:shadow-xl transition-all">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Ingresos Brutos</p>
            <p className="text-4xl font-black text-gray-900 tracking-tighter">{formatCurrency(stats.ventaTotal)}</p>
            <div className="mt-6 space-y-2">
               <div className="flex justify-between text-[9px] font-black uppercase">
                  <span className="text-gray-400">📲 App</span>
                  <span className="text-blue-600">{formatCurrency(stats.ventaApp)}</span>
               </div>
               <div className="w-full bg-gray-50 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full" style={{ width: `${(stats.ventaApp / stats.ventaTotal) * 100}%` }}></div>
               </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 group hover:shadow-xl transition-all">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Inversión (Costo)</p>
            <p className="text-4xl font-black text-gray-700 tracking-tighter">{formatCurrency(stats.costoTotal)}</p>
            <div className="mt-6 flex items-center justify-between">
               <span className="text-[9px] font-black text-gray-400 uppercase">Eficiencia de compra</span>
               <span className="text-[11px] font-black text-gray-900">{((stats.costoTotal/stats.ventaTotal)*100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="bg-green-600 p-8 rounded-[3rem] shadow-2xl shadow-green-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-10 text-6xl font-black italic text-white group-hover:rotate-6 transition-transform">$$</div>
            <p className="text-[10px] font-black text-green-200 uppercase tracking-[0.2em] mb-2">Utilidad Neta</p>
            <p className="text-4xl font-black text-white tracking-tighter">{formatCurrency(stats.utilidad)}</p>
            <div className="mt-6 inline-block bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full">
               <span className="text-white font-black text-[10px] uppercase tracking-widest">Margen: {stats.margenPorcentaje.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* ANALISIS SECUNDARIO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-gray-900 uppercase italic tracking-tight">🏆 Productos Top</h3>
              <span className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full uppercase">Por Utilidad</span>
            </div>
            <div className="space-y-8">
              {topProducts.map((prod, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-sm font-black text-gray-800 uppercase tracking-tighter">{prod.nombre}</span>
                    <span className="text-sm font-black text-green-600">{formatCurrency(prod.utilidad)}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full group-hover:bg-green-400 transition-colors" style={{ width: `${(prod.utilidad / prod.ventaTotal) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="bg-gray-900 p-10 rounded-[3.5rem] text-white relative overflow-hidden">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3">Ticket Promedio</p>
              <p className="text-5xl font-black italic tracking-tighter">{formatCurrency(stats.ticketPromedio)}</p>
              <div className="mt-10 grid grid-cols-2 gap-4">
                 <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Volumen</p>
                    <p className="font-black text-2xl tracking-tighter">{stats.numPedidos} Pedidos</p>
                 </div>
                 <div className="bg-white/5 p-5 rounded-3xl border border-white/10 text-green-400">
                    <p className="text-[9px] font-black text-green-700 uppercase mb-1">Crecimiento</p>
                    <p className="font-black text-2xl tracking-tighter">100%</p>
                 </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-gray-100 text-center">
               <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em] mb-2">Sistema Operativo Amoree</p>
               <p className="text-xs font-bold text-gray-500 italic">"Los datos no mienten, el negocio crece."</p>
            </div>
          </div>
        </div>

        {/* FIRMA DE PODER: AUTOMATIZA CON RAUL */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
           <div className="bg-gray-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-3xl flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-3">
                 <div className="bg-green-600 p-2 rounded-xl">🚀</div>
                 <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Socio Tecnológico</p>
                 </div>
              </div>
              <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
              <div className="text-right">
                 <p className="text-[8px] font-black text-green-500 uppercase tracking-widest mb-1">Estatus</p>
                 <p className="text-[10px] font-black text-white">OPTIMIZADO</p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
