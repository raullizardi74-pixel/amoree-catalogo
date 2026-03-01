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

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Buscamos pedidos que estén Pagados O Finalizados
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['Pagado - Por Entregar', 'Finalizado']);

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
          p.detalle_pedido?.forEach((item: any) => {
            c += ((item.costo || 0) * item.quantity);
          });
        });
        return { totalVentas: v, totalCostos: c, utilidad: v - c, numPedidos: n, ticketPromedio: n > 0 ? v / n : 0 };
      };

      const pedidosHoy = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: hoyInicio, end: hoyFin }));
      const pedidosSemanaPasada = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: semanaPasadaInicio, end: semanaPasadaFin }));

      setStatsHoy(calcularStats(pedidosHoy));
      setStatsSemanaPasada(calcularStats(pedidosSemanaPasada));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="p-10 text-center font-bold text-green-700 animate-pulse">ACTUALIZANDO CAJA...</div>;

  const variacionVenta = statsHoy && statsSemanaPasada && statsSemanaPasada.totalVentas > 0
    ? ((statsHoy.totalVentas - statsSemanaPasada.totalVentas) / statsSemanaPasada.totalVentas) * 100
    : 0;

  return (
    <div className="p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-blue-100">
            <p className="text-[10px] font-black text-blue-500 uppercase mb-1">Ventas Hoy</p>
            <p className="text-3xl font-black text-blue-900">{formatCurrency(statsHoy?.totalVentas || 0)}</p>
            <div className={`mt-2 text-[10px] font-bold ${variacionVenta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {variacionVenta >= 0 ? '▲' : '▼'} {Math.abs(variacionVenta).toFixed(1)}% vs semana pasada
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Costo Mercancía</p>
            <p className="text-3xl font-black text-gray-700">{formatCurrency(statsHoy?.totalCostos || 0)}</p>
          </div>
          <div className="bg-green-600 p-5 rounded-3xl shadow-lg shadow-green-100">
            <p className="text-[10px] font-black text-green-200 uppercase mb-1">Utilidad Real</p>
            <p className="text-3xl font-black text-white">{formatCurrency(statsHoy?.utilidad || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
