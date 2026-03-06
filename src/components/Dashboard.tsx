import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format 
} from 'date-fns';
import { es } from 'date-fns/locale/es';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  
  // Estados para Merma
  const [skuMerma, setSkuMerma] = useState('');
  const [cantMerma, setCantMerma] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: p } = await supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']);
    const { data: pr } = await supabase.from('productos').select('*').order('nombre');
    const { data: m } = await supabase.from('merma').select('*');
    
    if (p) setPedidos(p);
    if (pr) setProductos(pr);
    if (m) setMermas(m);
    setLoading(false);
  };

  // --- MOTOR DE CÁLCULO TITANIUM ---
  const now = new Date();
  
  // Ventas por periodos
  const hoy = pedidos.filter(p => isSameDay(new Date(p.created_at), now));
  const ayer = pedidos.filter(p => isSameDay(new Date(p.created_at), subDays(now, 1)));
  const semana = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfWeek(now), end: endOfWeek(now) }));
  const semanaAnt = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: subWeeks(startOfWeek(now), 1), end: subWeeks(endOfWeek(now), 1) }));
  const mes = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfMonth(now), end: endOfMonth(now) }));
  const mesAnt = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: subMonths(startOfMonth(now), 1), end: subMonths(endOfMonth(now), 1) }));

  const vHoy = hoy.reduce((a, b) => a + b.total, 0);
  const vAyer = ayer.reduce((a, b) => a + b.total, 0);
  const vSem = semana.reduce((a, b) => a + b.total, 0);
  const vSemAnt = semanaAnt.reduce((a, b) => a + b.total, 0);
  const vMes = mes.reduce((a, b) => a + b.total, 0);
  const vMesAnt = mesAnt.reduce((a, b) => a + b.total, 0);

  // Merma y Utilidad
  const mMes = mermas.filter(m => new Date(m.created_at) >= startOfMonth(now)).reduce((a, b) => a + (b.total_perdida || 0), 0);
  const costoMes = mes.reduce((acc, p) => acc + (p.detalle_pedido?.reduce((iAcc:any, i:any) => iAcc + ((i.costo || 0) * i.quantity), 0) || 0), 0);
  const margenBruto = vMes > 0 ? ((vMes - costoMes) / vMes) * 100 : 0;
  const porcMerma = vMes > 0 ? (mMes / vMes) * 100 : 0;

  // Top 5 Productos del día
  const top5 = (() => {
    const counts: any = {};
    hoy.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      counts[i.nombre] = (counts[i.nombre] || 0) + i.quantity;
    }));
    return Object.entries(counts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5);
  })();

  const tabs = [
    { id: 1, label: 'Ejecutivo', icon: '🎯' },
    { id: 2, label: 'Ventas', icon: '💰' },
    { id: 3, label: 'Inventario', icon: '📦' },
    { id: 4, label: 'Merma', icon: '🗑️' },
    { id: 5, label: 'Rentabilidad', icon: '📊' },
    { id: 6, label: 'Compras', icon: '🛒' },
    { id: 7, label: 'Alertas', icon: '🚨' }
  ];

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black tracking-[0.5em]">CARGANDO AMOREE BI...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-6 md:p-10 text-white font-sans">
      
      {/* TABS NAVEGACIÓN */}
      <div className="flex overflow-x-auto gap-3 pb-8 no-scrollbar border-b border-white/5 sticky top-0 bg-[#050505] z-30">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-black scale-105' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
            <span>{tab.icon}</span> <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-10 space-y-12 animate-in fade-in duration-700">
        
        {/* PESTAÑA 1: PANEL EJECUTIVO (EL CORAZÓN) */}
        {activeTab === 1 && (
          <div className="space-y-10">
            {/* KPI ROW 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Ventas Hoy</p>
                <p className="text-4xl font-black">{formatCurrency(vHoy)}</p>
                <span className={`text-[10px] font-bold ${vHoy >= vAyer ? 'text-green-500' : 'text-red-500'}`}>
                  {vHoy >= vAyer ? '▲' : '▼'} {Math.abs(vHoy - vAyer).toFixed(0)} vs ayer
                </span>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Semana Actual</p>
                <p className="text-4xl font-black">{formatCurrency(vSem)}</p>
                <span className={`text-[10px] font-bold ${vSem >= vSemAnt ? 'text-green-500' : 'text-red-500'}`}>
                  {vSem >= vSemAnt ? '▲' : '▼'} {Math.abs(vSem - vSemAnt).toFixed(0)} vs ant.
                </span>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Mes Actual</p>
                <p className="text-4xl font-black text-green-500">{formatCurrency(vMes)}</p>
                <span className={`text-[10px] font-bold ${vMes >= vMesAnt ? 'text-green-500' : 'text-red-500'}`}>
                   {vMes >= vMesAnt ? '▲' : '▼'} {Math.abs(vMes - vMesAnt).toFixed(0)} vs ant.
                </span>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Ticket Promedio</p>
                <p className="text-4xl font-black">{formatCurrency(vHoy / (hoy.length || 1))}</p>
              </div>
            </div>

            {/* KPI ROW 2: EFICIENCIA */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-red-600/10 p-10 rounded-[50px] border border-red-600/20">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Merma del Mes (%)</p>
                  <p className="text-5xl font-black">{porcMerma.toFixed(1)}%</p>
                  <p className="text-[9px] text-gray-500 mt-2 uppercase font-bold">Pérdida: {formatCurrency(mMes)}</p>
               </div>
               <div className="bg-green-600/10 p-10 rounded-[50px] border border-green-600/20">
                  <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-3">Margen Bruto Prom.</p>
                  <p className="text-5xl font-black">{margenBruto.toFixed(1)}%</p>
                  <p className="text-[9px] text-gray-500 mt-2 uppercase font-bold">Salud financiera: Óptima</p>
               </div>
               <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase mb-5 tracking-widest">🔥 Top 5 Productos (Hoy)</h4>
                  <div className="space-y-3">
                    {top5.map(([name, qty]: any) => (
                      <div key={name} className="flex justify-between items-center text-xs font-bold border-b border-white/5 pb-2">
                        <span className="text-gray-400 uppercase">{name}</span>
                        <span className="text-white">{qty} unid.</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: VENTAS (ANÁLISIS DE TENDENCIA) */}
        {activeTab === 2 && (
          <div className="space-y-10">
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[450px]">
              <h3 className="text-xl font-black italic uppercase mb-8">Tendencia de Ventas (Últimos 7 días)</h3>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={Array.from({length: 7}).map((_, i) => {
                  const d = subDays(new Date(), 6 - i);
                  const v = pedidos.filter(p => isSameDay(new Date(p.created_at), d)).reduce((a, b) => a + b.total, 0);
                  return { day: format(d, 'EEE', {locale: es}), total: v };
                })}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="day" stroke="#555" fontSize={10} fontStyle="bold" axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{backgroundColor: '#000', borderRadius: '15px', border: 'none', fontSize: '10px'}} />
                  <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* MÓDULO DE MERMA (RESTAURADO) */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-fit sticky top-28">
              <h3 className="text-2xl font-black uppercase italic mb-8">Registrar Merma</h3>
              <div className="space-y-6">
                <select value={skuMerma} onChange={(e) => setSkuMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none">
                  <option value="" className="bg-black">-- Seleccionar --</option>
                  {productos.map(p => <option key={p.sku} value={p.sku} className="bg-black">{p.nombre}</option>)}
                </select>
                <input type="number" placeholder="Cantidad" value={cantMerma} onChange={(e) => setCantMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-xl font-black outline-none" />
                <button onClick={async () => {
                   const p = productos.find(x => x.sku === skuMerma);
                   if(!p) return;
                   setIsProcessing(true);
                   const { error } = await supabase.from('merma').insert([{ producto_sku: p.sku, nombre_producto: p.nombre, cantidad: parseFloat(cantMerma), unidad: p.unidad, costo_unitario: p.costo, total_perdida: parseFloat(cantMerma)*p.costo, motivo: 'Merma Natural', categoria: p.categoria }]);
                   if(!error) {
                      await supabase.from('productos').update({ stock_actual: (p.stock_actual || 0) - parseFloat(cantMerma) }).eq('sku', p.sku);
                      alert("Merma registrada."); setCantMerma(''); fetchData();
                   }
                   setIsProcessing(false);
                }} disabled={isProcessing} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl">
                  {isProcessing ? 'REGISTRANDO...' : '🗑️ Registrar Pérdida'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
