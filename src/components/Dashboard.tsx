import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval, format, isSameDay, startOfWeek, endOfWeek, startOfMonth } from 'date-fns';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ventasHoy: 0,
    ventasSemana: 0,
    ventasMes: 0,
    ticketPromedio: 0,
    utilidadHoy: 0,
    vsAyer: 0
  });

  // --- LÓGICA DE NAVEGACIÓN Y CARGA DE DATOS ---
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const now = new Date();
    
    // Consultas a Pedidos, Merma y Compras
    const { data: pedidos } = await supabase.from('pedidos').select('*').in('estado', ['Pagado - Por Entregar', 'Finalizado', 'Pagado']);
    
    if (pedidos) {
      const hoy = pedidos.filter(p => isSameDay(new Date(p.created_at), now));
      const ayer = pedidos.filter(p => isSameDay(new Date(p.created_at), subDays(now, 1)));
      const semana = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfWeek(now), end: endOfWeek(now) }));
      const mes = pedidos.filter(p => new Date(p.created_at) >= startOfMonth(now));

      const vHoy = hoy.reduce((a, b) => a + b.total, 0);
      const vAyer = ayer.reduce((a, b) => a + b.total, 0);

      setStats({
        ventasHoy: vHoy,
        ventasSemana: semana.reduce((a, b) => a + b.total, 0),
        ventasMes: mes.reduce((a, b) => a + b.total, 0),
        ticketPromedio: vHoy / (hoy.length || 1),
        utilidadHoy: vHoy * 0.25, // Estimado inicial
        vsAyer: vAyer > 0 ? ((vHoy - vAyer) / vAyer) * 100 : 0
      });
    }
    setLoading(false);
  };

  const tabs = [
    { id: 1, label: 'Ejecutivo', icon: '🎯' },
    { id: 2, label: 'Ventas', icon: '💰' },
    { id: 3, label: 'Inventario', icon: '📦' },
    { id: 4, label: 'Merma', icon: '🗑️' },
    { id: 5, label: 'Rentabilidad', icon: '📊' },
    { id: 6, label: 'Compras', icon: '🛒' },
    { id: 7, label: 'Alertas', icon: '🚨' }
  ];

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-8 space-y-8 text-white">
      {/* NAVEGACIÓN DE 7 PESTAÑAS (SCROLLABLE EN MÓVIL) */}
      <div className="flex overflow-x-auto gap-2 pb-4 no-scrollbar border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-green-600 text-white shadow-lg shadow-green-600/20 scale-105' : 'bg-white/5 text-gray-500 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* RENDERIZADO DE PESTAÑAS */}
      <div className="animate-in fade-in duration-500">
        {activeTab === 1 && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 p-8 rounded-[40px] border border-white/10">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Ventas Hoy</p>
                <p className="text-4xl font-black">{formatCurrency(stats.ventasHoy)}</p>
                <p className={`text-[10px] font-bold mt-2 ${stats.vsAyer >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.vsAyer >= 0 ? '▲' : '▼'} {Math.abs(stats.vsAyer).toFixed(1)}% vs Ayer
                </p>
              </div>
              <div className="bg-white/5 p-8 rounded-[40px] border border-white/10">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Semana Actual</p>
                <p className="text-4xl font-black">{formatCurrency(stats.ventasSemana)}</p>
              </div>
              <div className="bg-white/5 p-8 rounded-[40px] border border-white/10">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Mes Actual</p>
                <p className="text-4xl font-black">{formatCurrency(stats.ventasMes)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-green-600 p-10 rounded-[50px] shadow-2xl shadow-green-600/20">
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Ticket Promedio</p>
                  <p className="text-5xl font-black text-white">{formatCurrency(stats.ticketPromedio)}</p>
               </div>
               <div className="bg-white/5 p-10 rounded-[50px] border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Utilidad Estimada (Hoy)</p>
                    <p className="text-4xl font-black text-green-500">{formatCurrency(stats.utilidadHoy)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-gray-600 uppercase mb-1 tracking-tighter">Margen Promedio</p>
                    <p className="text-2xl font-black text-white">25%</p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white/5 p-10 rounded-[50px] border border-white/10">
              <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter">Registro Rápido de Merma</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Aquí implementaremos la selección de producto y cantidad */}
                <p className="text-gray-500 text-xs italic">Panel de ingreso de desperdicios en desarrollo...</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Los demás contenidos se inyectarán paso a paso */}
        {[2,3,5,6,7].includes(activeTab) && (
          <div className="p-20 text-center bg-white/5 rounded-[50px] border border-dashed border-white/10">
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em]">Módulo en Fase de Calibración</p>
          </div>
        )}
      </div>
    </div>
  );
}
