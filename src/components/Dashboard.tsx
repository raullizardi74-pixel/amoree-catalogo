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
  const [periodo, setPeriodo] = useState('0'); // Por defecto HOY para la tablet del local
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
        
        // --- LOGICA DE CANALES (EL CORAZON DEL NEGOCIO) ---
        // Si el pedido se marca con origen 'Mostrador' se suma ahí, de lo contrario es App
        if (p.origen === 'Mostrador') {
          vMostrador += p.total;
        } else {
          vApp += p.total;
        }

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
        
        {/* HEADER CON CALENDARIO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">
              Intelligence <span className="text-green-600">Center</span>
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Análisis Omnicanal Amoree
            </p>
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

        {/* DISTRIBUCIÓN DE CANALES (EL FOCO DE HUGO) */}
        <div className="bg-white p-8 rounded-[3.5rem] shadow-sm border border-gray-100 mb-10">
          <div className="flex justify-between items-end mb-6">
             <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rendimiento por Canal</p>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter italic uppercase">App vs Local</h3>
             </div>
             <div className="text-right">
                <p className="text-2xl font-black text-green-600 tracking-tighter">{formatCurrency(stats.ventaTotal)}</p>
                <p className="text-[9px] font-black text-gray-300 uppercase">Venta Total Bruta</p>
             </div>
          </div>
          
          <div className="space-y-6">
            {/* CANAL APP */}
            <div>
              <div className="flex justify-between text-[11px] font-black uppercase mb-2">
                <span className="text-blue-600">🛒 Pedidos por App</span>
                <span>{formatCurrency(stats.ventaApp)} <span className="text-gray-300 ml-2">({stats.ventaTotal > 0 ? ((stats.ventaApp/stats.ventaTotal)*100).toFixed(1) : 0}%)</span></span>
              </div>
              <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${(stats.ventaApp / stats.ventaTotal) * 100}%` }}></div>
              </div>
            </div>

            {/* CANAL LOCAL */}
            <div>
              <div className="flex justify-between text-[11px] font-black uppercase mb-2">
                <span className="text-orange-600">🏪 Venta en Mostrador</span>
                <span>{formatCurrency(stats.ventaMostrador)} <span className="text-gray-300 ml-2">({stats.ventaTotal > 0 ? ((stats.ventaMostrador/stats.ventaTotal)*100).toFixed(1) : 0}%)</span></span>
              </div>
              <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                <div className="bg-orange-600 h-full transition-all duration-1000" style={{ width: `${(stats.ventaMostrador / stats.ventaTotal) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* METRICAS FINANCIERAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inversión Mercancía</p>
              <p className="text-4xl font-black text-gray-900 tracking-tighter">{formatCurrency(stats.costoTotal)}</p>
            </div>
            <div className="mt-8 flex justify-between items-center">
               <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Eficiencia: {((stats.costoTotal/stats.ventaTotal)*100).toFixed(0)}%</span>
               <span className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full uppercase italic">Análisis de Costos</span>
            </div>
          </div>

          <div className="bg-green-600 p-8 rounded-[3rem] shadow-2xl shadow-green-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 text-7xl font-black italic text-white group-hover:scale-110 transition-transform">$$</div>
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">Utilidad Neta Real</p>
            <p className="text-5xl font-black text-white tracking-tighter">{formatCurrency(stats.utilidad)}</p>
            <div className="mt-8">
               <span className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest">
                  Margen: {stats.margenPorcentaje.toFixed(1)}%
               </span>
            </div>
          </div>
        </div>

        {/* PRODUCTOS Y TICKET */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-900 uppercase italic mb-8 tracking-tight flex items-center gap-2">
              🏆 Ranking de Utilidad
            </h3>
            <div className="space-y-6">
              {topProducts.map((prod, idx) => (
                <div key={idx} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-black text-gray-800 uppercase tracking-tighter">{prod.nombre}</span>
                    <span className="text-xs font-black text-green-600">{formatCurrency(prod.utilidad)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full group-hover:bg-green-400 transition-all" style={{ width: `${(prod.utilidad / prod.ventaTotal) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 p-10 rounded-[3.5rem] text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ticket Promedio Bruto</p>
            <p className="text-5xl font-black italic tracking-tighter mb-8">{formatCurrency(stats.ticketPromedio)}</p>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                  <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Volumen</p>
                  <p className="font-black text-2xl tracking-tighter">{stats.numPedidos} Op.</p>
               </div>
               <div className="bg-white/5 p-5 rounded-3xl border border-white/10 text-green-400">
                  <p className="text-[8px] font-black text-green-700 uppercase mb-1">Status</p>
                  <p className="font-black text-2xl tracking-tighter uppercase">Saludable</p>
               </div>
            </div>
          </div>
        </div>

        {/* FIRMA DE PODER: AUTOMATIZA CON RAUL (MODO SELLO DE GARANTÍA) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
           <div className="bg-white/80 backdrop-blur-xl border border-gray-200 p-4 rounded-3xl flex items-center justify-between shadow-2xl">
              <div className="flex items-center gap-3">
                 <div className="bg-green-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-green-200">🚀</div>
                 <div>
                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Engineering & Business Intelligence</p>
                 </div>
              </div>
              <div className="h-8 w-[1px] bg-gray-200 mx-2"></div>
              <div className="text-right">
                 <p className="text-[8px] font-black text-green-600 uppercase tracking-widest mb-1">Certificado</p>
                 <p className="text-[10px] font-black text-gray-900">2026</p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
