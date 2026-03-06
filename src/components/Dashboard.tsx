import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie 
} from 'recharts';
import { 
  startOfDay, isSameDay, startOfWeek, endOfWeek, startOfMonth, 
  endOfMonth, subDays, subWeeks, subMonths, isWithinInterval, format 
} from 'date-fns';
import { es } from 'date-fns/locale/es';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [pedidosRes, productosRes, mermasRes] = await Promise.all([
          supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']),
          supabase.from('productos').select('*').order('nombre'),
          supabase.from('merma').select('*')
        ]);
        
        if (pedidosRes.data) setPedidos(pedidosRes.data);
        if (productosRes.data) setProductos(productosRes.data);
        if (mermasRes.data) setMermas(mermasRes.data);
      } catch (error) {
        console.error("Error en Amoree Intelligence:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // --- ENGINE DE DATOS CON MEMORIA (Optimizado para React 19) ---
  const stats = useMemo(() => {
    const now = new Date();
    const hoyPedidos = pedidos.filter(p => isSameDay(new Date(p.created_at), now));
    const ayerPedidos = pedidos.filter(p => isSameDay(new Date(p.created_at), subDays(now, 1)));
    
    const vHoy = hoyPedidos.reduce((a, b) => a + b.total, 0);
    const vAyer = ayerPedidos.reduce((a, b) => a + b.total, 0);

    return {
      vHoy,
      vAyer,
      vsAyer: vAyer > 0 ? ((vHoy - vAyer) / vAyer) * 100 : 0,
      ticketPromedio: vHoy / (hoyPedidos.length || 1),
      countHoy: hoyPedidos.length
    };
  }, [pedidos]);

  const tabs = [
    { id: 1, label: 'Ejecutivo', icon: '🎯' },
    { id: 2, label: 'Ventas', icon: '💰' },
    { id: 3, label: 'Inventario', icon: '📦' },
    { id: 4, label: 'Merma', icon: '🗑️' },
    { id: 5, label: 'Rentabilidad', icon: '📊' },
    { id: 6, label: 'Compras', icon: '🛒' },
    { id: 7, label: 'Alertas', icon: '🚨' }
  ];

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-green-500">
      <div className="w-10 h-10 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-4"></div>
      <p className="font-black uppercase tracking-[0.4em] text-[10px]">Sincronizando Titanium OS...</p>
    </div>
  );

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white font-sans">
      {/* NAVEGADOR DE TABS */}
      <div className="flex overflow-x-auto gap-3 pb-6 border-b border-white/5 no-scrollbar sticky top-0 bg-[#050505] z-50">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-black scale-105 shadow-2xl' : 'bg-white/5 text-gray-500 hover:text-white'
            }`}
          >
            <span className="text-lg">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {activeTab === 1 && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Ventas Hoy</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(stats.vHoy)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${stats.vsAyer >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {stats.vsAyer >= 0 ? '▲' : '▼'} {Math.abs(stats.vsAyer).toFixed(1)}% vs Ayer
                </div>
              </div>
              
              <div className="bg-green-600 p-10 rounded-[45px] shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-4">Ticket Promedio</p>
                <p className="text-5xl font-black text-white tracking-tighter">{formatCurrency(stats.ticketPromedio)}</p>
                <p className="text-[9px] font-bold text-white/40 uppercase mt-4">{stats.countHoy} Ventas el día de hoy</p>
              </div>

              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 flex flex-col justify-center">
                <h4 className="text-[10px] font-black text-red-500 uppercase mb-5 tracking-widest italic">⚠️ Inventario Crítico</h4>
                <div className="space-y-3">
                  {productos.filter(p => p.stock_actual <= 5).slice(0, 3).map(p => (
                    <div key={p.sku} className="flex justify-between text-xs font-bold border-b border-white/5 pb-2">
                      <span className="text-gray-400 uppercase">{p.nombre}</span>
                      <span className="text-white">{p.stock_actual} {p.unidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODULO EN CONSTRUCCIÓN */}
        {activeTab !== 1 && (
          <div className="min-h-[400px] flex flex-col items-center justify-center bg-[#0A0A0A] rounded-[60px] border-2 border-dashed border-white/5">
             <div className="text-6xl mb-6 opacity-10">🚀</div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] mb-4">Módulo {tabs.find(t=>t.id===activeTab)?.label}</p>
             <p className="text-xs text-gray-700 font-bold text-center max-w-sm">
                Inyectando algoritmos de Recharts para visualización de datos en tiempo real.
             </p>
          </div>
        )}
      </div>

      {/* FIRMA DE GARANTÍA */}
      <div className="fixed bottom-10 left-10 z-[100] hidden md:block">
         <div className="bg-black/90 backdrop-blur-3xl border border-white/10 p-5 rounded-[35px] flex items-center gap-5 shadow-2xl">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-2xl shadow-xl shadow-green-600/20">🚀</div>
            <div>
               <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
               <p className="text-[8px] font-bold text-green-500/50 uppercase tracking-[0.4em]">Engineering Partner</p>
            </div>
         </div>
      </div>
    </div>
  );
}
