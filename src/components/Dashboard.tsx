import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';

interface Stats {
  totalVentas: number;
  totalCostos: number;
  utilidad: number;
  numPedidos: number;
  ticketPromedio: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [statsHoy, setStatsHoy] = useState<Stats | null>(null);
  const [statsSemanaPasada, setStatsSemanaPasada] = useState<Stats | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Traer todos los pedidos PAGADOS (necesitamos histórico para comparar)
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'Pagado');

      if (error) throw error;

      const ahora = new Date();
      const hoyInicio = startOfDay(ahora);
      const hoyFin = endOfDay(ahora);
      const semanaPasadaInicio = startOfDay(subDays(ahora, 7));
      const semanaPasadaFin = endOfDay(subDays(ahora, 7));

      const calcularStats = (items: any[]) => {
        let v = 0, c = 0, n = 0;
        items.forEach(p => {
          v += p.total;
          n++;
          // Calcular costo desde el detalle_pedido
          p.detalle_pedido?.forEach((item: any) => {
            const costoUnitario = item.costo || 0;
            c += (costoUnitario * item.quantity);
          });
        });
        return {
          totalVentas: v,
          totalCostos: c,
          utilidad: v - c,
          numPedidos: n,
          ticketPromedio: n > 0 ? v / n : 0
        };
      };

      // Filtrar por fechas
      const pedidosHoy = pedidos.filter(p => 
        isWithinInterval(new Date(p.created_at), { start: hoyInicio, end: hoyFin })
      );
      const pedidosSemanaPasada = pedidos.filter(p => 
        isWithinInterval(new Date(p.created_at), { start: semanaPasadaInicio, end: semanaPasadaFin })
      );

      setStatsHoy(calcularStats(pedidosHoy));
      setStatsSemanaPasada(calcularStats(pedidosSemanaPasada));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-center font-bold text-green-700 animate-pulse">CARGANDO INTELIGENCIA FINANCIERA...</div>;

  const variacionVenta = statsHoy && statsSemanaPasada && statsSemanaPasada.totalVentas > 0
    ? ((statsHoy.totalVentas - statsSemanaPasada.totalVentas) / statsSemanaPasada.totalVentas) * 100
    : 0;

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-black text-gray-800 mb-6 uppercase italic tracking-tighter">Resumen de Negocio</h2>

        {/* TARJETAS PRINCIPALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          
          {/* VENTA TOTAL */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-blue-100">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Ventas Hoy</p>
            <p className="text-3xl font-black text-blue-900">{formatCurrency(statsHoy?.totalVentas || 0)}</p>
            <div className={`mt-2 text-[10px] font-bold ${variacionVenta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {variacionVenta >= 0 ? '▲' : '▼'} {Math.abs(variacionVenta).toFixed(1)}% vs semana pasada
            </div>
          </div>

          {/* COSTO TOTAL */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Costo Mercancía</p>
            <p className="text-3xl font-black text-gray-700">{formatCurrency(statsHoy?.totalCostos || 0)}</p>
            <p className="text-[9px] text-gray-400 mt-2 font-medium italic">*Basado en costos capturados</p>
          </div>

          {/* UTILIDAD NETA */}
          <div className="bg-green-600 p-5 rounded-3xl shadow-lg shadow-green-100">
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">Utilidad Real</p>
            <p className="text-3xl font-black text-white">{formatCurrency(statsHoy?.utilidad || 0)}</p>
            <p className="text-[10px] text-green-100 mt-2 font-bold">Ganancia neta del día</p>
          </div>
        </div>

        {/* MÉTRICAS SECUNDARIAS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase">Pedidos</p>
              <p className="text-xl font-black text-gray-800">{statsHoy?.numPedidos}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-full text-lg">📦</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase">Ticket Promedio</p>
              <p className="text-xl font-black text-gray-800">{formatCurrency(statsHoy?.ticketPromedio || 0)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-full text-lg">🎫</div>
          </div>
        </div>

        {/* MENSAJE DE VALOR */}
        <div className="mt-8 bg-blue-900 text-blue-100 p-6 rounded-3xl">
          <h3 className="font-black uppercase text-sm mb-2 italic">Amoree Business Insights</h3>
          <p className="text-xs leading-relaxed opacity-80">
            Este reporte automático te ahorra 2 horas de contabilidad diaria. La membresía de Amoree ($15/día) se paga sola al optimizar tu utilidad y detectar qué días vendes más.
          </p>
        </div>
      </div>
    </div>
  );
}
