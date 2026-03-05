import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval, format, isSameDay } from 'date-fns';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ventasHoy: 0,
    ventasMes: 0,
    ticketPromedio: 0,
    utilidad: 0,
    transacciones: 0,
    vsAyer: 0,
    ventaApp: 0,
    ventaLocal: 0
  });

  const fetchData = async () => {
    setLoading(true);
    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const { data: pedidos } = await supabase.from('pedidos')
      .select('*')
      .in('estado', ['Pagado - Por Entregar', 'Finalizado', 'Pagado']);

    if (pedidos) {
      const hoy = pedidos.filter(p => isSameDay(new Date(p.created_at), today));
      const ayer = pedidos.filter(p => isSameDay(new Date(p.created_at), subDays(today, 1)));
      const mes = pedidos.filter(p => new Date(p.created_at) >= startMonth);

      const vHoy = hoy.reduce((a, b) => a + b.total, 0);
      const vAyer = ayer.reduce((a, b) => a + b.total, 0);
      const vMes = mes.reduce((a, b) => a + b.total, 0);
      
      setStats({
        ventasHoy: vHoy,
        ventasMes: vMes,
        ticketPromedio: vHoy / (hoy.length || 1),
        utilidad: vMes * 0.25, // Estimado 25%
        transacciones: hoy.length,
        vsAyer: vAyer > 0 ? ((vHoy - vAyer) / vAyer) * 100 : 0,
        ventaApp: hoy.filter(p => p.origen !== 'Mostrador').reduce((a,b) => a+b.total, 0),
        ventaLocal: hoy.filter(p => p.origen === 'Mostrador').reduce((a,b) => a+b.total, 0)
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="bg-[#050505] p-8 rounded-[50px] space-y-10 border border-white/5">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tighter italic uppercase">Cockpit <span className="text-green-500">Ejecutivo</span></h2>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.4em] mt-2">Inteligencia de Datos Amoree</p>
        </div>
        <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/10 text-right">
          <p className="text-[8px] font-black text-gray-500 uppercase">Status Operativo</p>
          <p className="text-xs font-black text-green-500 animate-pulse">OPTIMIZADO</p>
        </div>
      </div>

      {/* KPIS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-2xl">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Ventas Hoy</p>
          <p className="text-4xl font-black text-white">{formatCurrency(stats.ventasHoy)}</p>
          <p className={`text-[10px] font-black mt-2 ${stats.vsAyer >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {stats.vsAyer >= 0 ? '▲' : '▼'} {Math.abs(stats.vsAyer).toFixed(1)}% vs Ayer
          </p>
        </div>
        <div className="bg-green-600 p-8 rounded-[40px] shadow-2xl shadow-green-600/20">
          <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-3">Ticket Promedio</p>
          <p className="text-4xl font-black text-white">{formatCurrency(stats.ticketPromedio)}</p>
          <p className="text-[10px] font-black mt-2 text-white/70 uppercase">{stats.transacciones} Transacciones</p>
        </div>
        <div className="bg-white/5 p-8 rounded-[40px] border border-white/10">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Venta del Mes</p>
          <p className="text-4xl font-black text-white">{formatCurrency(stats.ventasMes)}</p>
        </div>
        <div className="bg-white/5 p-8 rounded-[40px] border border-white/10">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Utilidad (Est.)</p>
          <p className="text-4xl font-black text-green-500">{formatCurrency(stats.utilidad)}</p>
        </div>
      </div>

      {/* ANALISIS DE CANAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white/[0.02] p-10 rounded-[50px] border border-white/5">
          <h3 className="text-lg font-black uppercase italic mb-8 tracking-tighter">Rendimiento por Canal</h3>
          <div className="space-y-8">
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                <span className="text-blue-500">🛒 App Amoree</span>
                <span>{formatCurrency(stats.ventaApp)}</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${(stats.ventaApp/(stats.ventasHoy||1))*100}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-3">
                <span className="text-orange-500">🏪 Venta en Local</span>
                <span>{formatCurrency(stats.ventaLocal)}</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]" style={{ width: `${(stats.ventaLocal/(stats.ventasHoy||1))*100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] p-10 rounded-[50px] border border-white/5 flex flex-col items-center justify-center text-center">
            <div className="bg-green-600/10 w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4 border border-green-500/20">🚀</div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">Automatizado por</p>
            <p className="text-2xl font-black text-white uppercase tracking-tighter">Raul Lizardi</p>
            <p className="text-[8px] font-bold text-green-500 uppercase tracking-widest mt-2 px-4 py-1 border border-green-500/20 rounded-full">Engineering Partner</p>
        </div>
      </div>
    </div>
  );
}
