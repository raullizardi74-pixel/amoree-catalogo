import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from 'date-fns';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('0');
  const [stats, setStats] = useState({
    ventaTotal: 0,
    costoTotal: 0,
    utilidad: 0,
    numPedidos: 0,
    ventaApp: 0,
    ventaMostrador: 0,
    transaccionesApp: 0,
    transaccionesMostrador: 0,
    ticketPromedio: 0
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: pedidos } = await supabase.from('pedidos').select('*').in('estado', ['Pagado - Por Entregar', 'Finalizado', 'Pagado']);
    
    if (pedidos) {
      const now = new Date();
      const dias = parseInt(periodo);
      const start = startOfDay(subDays(now, dias));
      const end = endOfDay(now);

      const filtrados = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start, end }));

      let vT = 0, cT = 0, vApp = 0, vMostrador = 0, tApp = 0, tMostrador = 0;

      filtrados.forEach(p => {
        vT += p.total;
        if (p.origen === 'Mostrador') {
          vMostrador += p.total;
          tMostrador++;
        } else {
          vApp += p.total;
          tApp++;
        }
        // Cálculo de costo desde el JSONB
        p.detalle_pedido?.forEach((item: any) => {
          cT += (item.costo || 0) * item.quantity;
        });
      });

      setStats({
        ventaTotal: vT,
        costoTotal: cT,
        utilidad: vT - cT,
        numPedidos: filtrados.length,
        ventaApp: vApp,
        ventaMostrador: vMostrador,
        transaccionesApp: tApp,
        transaccionesMostrador: tMostrador,
        ticketPromedio: vT / (filtrados.length || 1)
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [periodo]);

  if (loading) return <div className="p-10 text-center text-white">Analizando datos...</div>;

  return (
    <div className="bg-[#050505] p-8 rounded-[40px] border border-white/5 space-y-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black italic uppercase italic">Inteligencia <span className="text-green-500">Comercial</span></h2>
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-white/5 border border-white/10 p-4 rounded-2xl text-[10px] font-black uppercase">
          <option value="0">Hoy</option>
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ventas Netas</p>
          <p className="text-4xl font-black text-white">{formatCurrency(stats.ventaTotal)}</p>
          <p className="text-[9px] text-green-500 mt-2 font-bold uppercase">{stats.numPedidos} Transacciones Totales</p>
        </div>
        <div className="bg-green-600 p-8 rounded-[3rem] shadow-xl shadow-green-600/20">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Utilidad Estimada</p>
          <p className="text-4xl font-black text-white">{formatCurrency(stats.utilidad)}</p>
          <p className="text-[9px] text-white/70 mt-2 font-bold uppercase">Ticket Prom: {formatCurrency(stats.ticketPromedio)}</p>
        </div>
        <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 flex flex-col justify-center gap-4">
           <div>
             <div className="flex justify-between text-[9px] font-black uppercase mb-1">
               <span className="text-blue-400">🛒 App ({stats.transaccionesApp})</span>
               <span>{formatCurrency(stats.ventaApp)}</span>
             </div>
             <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${(stats.ventaApp/stats.ventaTotal)*100}%`}}></div></div>
           </div>
           <div>
             <div className="flex justify-between text-[9px] font-black uppercase mb-1">
               <span className="text-orange-400">🏪 Local ({stats.transaccionesMostrador})</span>
               <span>{formatCurrency(stats.ventaMostrador)}</span>
             </div>
             <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-orange-500" style={{width: `${(stats.ventaMostrador/stats.ventaTotal)*100}%`}}></div></div>
           </div>
        </div>
      </div>
    </div>
  );
}
