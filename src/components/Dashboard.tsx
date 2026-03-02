import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface ProductStats {
  nombre: string;
  cantidad: number;
  ventaTotal: number;
  costoTotal: number;
  utilidad: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7'); // Días o 'custom'
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
        
        // Diferenciación de Origen (Magia para Hugo)
        // Asumimos que si no tiene email de usuario registrado, es de "Invitado/App"
        // Si nosotros creamos ventas manuales, les pondremos origen "Mostrador"
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
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen pb-20">
      <div className="max-w-5xl mx-auto">
        
        {/* SELECTOR DE PERIODO EVOLUCIONADO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Panel de <span className="text-green-600">Resultados</span></h2>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Sincronizado en tiempo real</p>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100 w-full md:w-auto">
              {[{l:'Hoy',v:'0'},{l:'7D',v:'7'},{l:'30D',v:'30'},{l:'📅',v:'custom'}].map((btn) => (
                <button
                  key={btn.v} onClick={() => setPeriodo(btn.v)}
                  className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${periodo === btn.v ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
                >
                  {btn.l}
                </button>
              ))}
            </div>
            
            {periodo === 'custom' && (
              <div className="flex gap-2 animate-fade-in">
                <input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="text-[10px] font-bold p-2 rounded-xl border-0 shadow-sm outline-none" />
                <input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="text-[10px] font-bold p-2 rounded-xl border-0 shadow-sm outline-none" />
              </div>
            )}
          </div>
        </div>

        {/* KPIs PRINCIPALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Ventas Totales</p>
            <p className="text-3xl font-black text-gray-900">{formatCurrency(stats.ventaTotal)}</p>
            <div className="mt-4 flex gap-2">
               <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg uppercase">🛒 App: {formatCurrency(stats.ventaApp)}</span>
               <span className="text-[8px] font-black bg-orange-50 text-orange-600 px-2 py-1 rounded-lg uppercase">🏪 Local: {formatCurrency(stats.ventaMostrador)}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inversión Mercancía</p>
            <p className="text-3xl font-black text-gray-700">{formatCurrency(stats.costoTotal)}</p>
            <div className="mt-4 bg-gray-100 h-1.5 rounded-full overflow-hidden">
               <div className="bg-gray-400 h-full" style={{ width: `${(stats.costoTotal/stats.ventaTotal)*100}%` }}></div>
            </div>
          </div>

          <div className="bg-green-600 p-6 rounded-[2.5rem] shadow-xl shadow-green-100 relative">
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">Utilidad Neta</p>
            <p className="text-3xl font-black text-white">{formatCurrency(stats.utilidad)}</p>
            <p className="text-[10px] text-white/60 mt-4 font-bold uppercase tracking-widest">Margen Real: {stats.margenPorcentaje.toFixed(1)}%</p>
          </div>
        </div>

        {/* EFICIENCIA Y RENDIMIENTO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-900 uppercase italic mb-6">🏆 Productos más rentables</h3>
            <div className="space-y-6">
              {topProducts.map((prod, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-end mb-2 uppercase tracking-tighter">
                    <span className="text-xs font-black text-gray-700">{prod.nombre}</span>
                    <span className="text-xs font-black text-green-600">+{formatCurrency(prod.utilidad)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full flex overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${(prod.utilidad / prod.ventaTotal) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-900 p-8 rounded-[3rem] text-white">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ticket Promedio</p>
              <p className="text-4xl font-black italic tracking-tighter">{formatCurrency(stats.ticketPromedio)}</p>
              <div className="mt-6 flex items-center gap-4">
                 <div className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-bold text-gray-500 uppercase">Pedidos</p>
                    <p className="font-black text-xl">{stats.numPedidos}</p>
                 </div>
                 <div className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-bold text-gray-500 uppercase">Eficiencia</p>
                    <p className="font-black text-xl text-green-400">100%</p>
                 </div>
              </div>
            </div>
            
            {/* ANUNCIO AUTOMATIZA CON RAUL */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-xl">
               <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🚀</span>
                  <h4 className="font-black uppercase italic text-sm tracking-tight">Socio Tecnológico</h4>
               </div>
               <p className="text-[11px] font-medium leading-relaxed opacity-90 mb-6">
                  Este Dashboard de Inteligencia es propiedad de Hugo. Desarrollado y optimizado por **AUTOMATIZA CON RAUL**. 
                  <br/><br/>
                  _Transformamos negocios tradicionales en potencias digitales._
               </p>
               <div className="flex justify-between items-center border-t border-white/20 pt-4">
                  <span className="text-[9px] font-black uppercase tracking-widest">Automatiza con Raul</span>
                  <span className="text-[9px] font-black bg-white text-blue-600 px-3 py-1 rounded-full uppercase">Valor Agregado</span>
               </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-12 text-[8px] font-black text-gray-300 uppercase tracking-[0.5em]">
          Business Intelligence • Powered by Automatiza con Raul
        </p>

      </div>
    </div>
  );
}
