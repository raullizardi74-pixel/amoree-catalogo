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
  
  // Datos crudos de Supabase
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);

  // Estados para Registro de Merma (Pestaña 4)
  const [skuMerma, setSkuMerma] = useState('');
  const [cantMerma, setCantMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Merma Natural');
  const [isProcessing, setIsProcessing] = useState(false);

  // Metas Fijas de Rentabilidad (Pestaña 5)
  const METAS = { verduras: 0.35, cremeria: 0.25, abarrotes: 0.15 };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [pedRes, prodRes, merRes, comRes] = await Promise.all([
          supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']),
          supabase.from('productos').select('*').order('nombre'),
          supabase.from('merma').select('*').order('created_at', { ascending: false }),
          supabase.from('compras').select('*').order('created_at', { ascending: false })
        ]);
        if (pedRes.data) setPedidos(pedRes.data);
        if (prodRes.data) setProductos(prodRes.data);
        if (merRes.data) setMermas(merRes.data);
        if (comRes.data) setCompras(comRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  // --- ENGINE DE DATOS (Cálculos de periodos) ---
  const stats = useMemo(() => {
    const now = new Date();
    const getSum = (arr: any[]) => arr.reduce((acc, p) => acc + (p.total || 0), 0);

    const dHoy = pedidos.filter(p => isSameDay(new Date(p.created_at), now));
    const dSemana = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfWeek(now), end: endOfWeek(now) }));
    const dMes = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfMonth(now), end: endOfMonth(now) }));
    
    const dAyer = pedidos.filter(p => isSameDay(new Date(p.created_at), subDays(now, 1)));
    const dSemanaAnt = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: subWeeks(startOfWeek(now), 1), end: subWeeks(endOfWeek(now), 1) }));
    const dMesAnt = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: subMonths(startOfMonth(now), 1), end: subMonths(endOfMonth(now), 1) }));

    const vHoy = getSum(dHoy);
    const vAyer = getSum(dAyer);
    const vSemana = getSum(dSemana);
    const vSemanaAnt = getSum(dSemanaAnt);
    const vMes = getSum(dMes);
    const vMesAnt = getSum(dMesAnt);

    // Top 5 hoy
    const counts: any = {};
    dHoy.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      counts[i.nombre] = (counts[i.nombre] || 0) + i.quantity;
    }));
    const top5 = Object.entries(counts).sort(([,a]:any, [,b]:any) => b - a).slice(0, 5);

    // Merma mes
    const mMes = mermas.filter(m => new Date(m.created_at) >= startOfMonth(now)).reduce((a,b) => a + (b.total_perdida || 0), 0);

    return {
      vHoy, vSemana, vMes,
      vsAyer: vAyer > 0 ? ((vHoy - vAyer) / vAyer) * 100 : 0,
      vsSemana: vSemanaAnt > 0 ? ((vSemana - vSemanaAnt) / vSemanaAnt) * 100 : 0,
      vsMes: vMesAnt > 0 ? ((vMes - vMesAnt) / vMesAnt) * 100 : 0,
      ticket: vHoy / (dHoy.length || 1),
      mermaPorc: vMes > 0 ? (mMes / vMes) * 100 : 0,
      mMes, top5
    };
  }, [pedidos, mermas]);

  // --- REGISTRO DE MERMA ---
  const handleRegisterMerma = async () => {
    const prod = productos.find(p => p.sku === skuMerma);
    if (!prod || !cantMerma) return alert("Selecciona producto y cantidad");
    setIsProcessing(true);
    try {
      const cant = parseFloat(cantMerma);
      const perdida = cant * (prod.costo || 0);
      const { error } = await supabase.from('merma').insert([{
        producto_sku: prod.sku, nombre_producto: prod.nombre, cantidad: cant,
        unidad: prod.unidad, costo_unitario: prod.costo, total_perdida: perdida,
        motivo: motivoMerma, categoria: prod.categoria
      }]);
      if (!error) {
        await supabase.from('productos').update({ stock_actual: (prod.stock_actual || 0) - cant }).eq('sku', prod.sku);
        alert("Merma registrada ✅");
        setCantMerma(''); setSkuMerma('');
        window.location.reload();
      }
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black">ANALIZANDO AMOREE BI...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-8 text-white font-sans selection:bg-green-500/30">
      
      {/* TABS NAVEGACIÓN */}
      <div className="flex overflow-x-auto gap-3 pb-6 border-b border-white/5 sticky top-0 bg-[#050505] z-50 no-scrollbar">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-black scale-105 shadow-xl' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
            <span className="text-lg">{tab.icon}</span> <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* PESTAÑA 1: PANEL EJECUTIVO */}
        {activeTab === 1 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Ventas Hoy</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(stats.vHoy)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${stats.vsAyer >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {stats.vsAyer >= 0 ? '▲' : '▼'} {Math.abs(stats.vsAyer).toFixed(1)}% vs ayer
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Venta Semana vs Ant.</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(stats.vSemana)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${stats.vsSemana >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {stats.vsSemana >= 0 ? '▲' : '▼'} {Math.abs(stats.vsSemana).toFixed(1)}%
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Venta Mes vs Ant.</p>
                <p className="text-5xl font-black tracking-tighter text-green-500">{formatCurrency(stats.vMes)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${stats.vsMes >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {stats.vsMes >= 0 ? '▲' : '▼'} {Math.abs(stats.vsMes).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-green-600 p-12 rounded-[55px] shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Ticket Promedio</p>
                  <p className="text-7xl font-black text-white tracking-tighter">{formatCurrency(stats.ticket)}</p>
                  <div className="mt-10 flex gap-10">
                    <div><p className="text-[9px] font-black text-white/50 uppercase">Margen Est.</p><p className="text-2xl font-black text-white">25%</p></div>
                    <div><p className="text-[9px] font-black text-white/50 uppercase">Merma Mes</p><p className="text-2xl font-black text-red-200">{stats.mermaPorc.toFixed(1)}%</p></div>
                  </div>
               </div>
               <div className="bg-[#0A0A0A] p-12 rounded-[55px] border border-white/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter">🔥 Top 5 Hoy</h3>
                  <div className="space-y-4">
                    {stats.top5.map(([name, qty]: any) => (
                      <div key={name} className="flex justify-between items-center p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                        <span className="text-xs font-bold text-gray-400 uppercase">{name}</span>
                        <span className="text-xs font-black text-white">{qty} kg/pza</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: VENTAS (GRÁFICO TENDENCIA) */}
        {activeTab === 2 && (
          <div className="space-y-10">
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[450px]">
              <h3 className="text-xl font-black italic uppercase mb-10 tracking-tighter">Tendencia de Ventas (7 Días)</h3>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={Array.from({length: 7}).map((_, i) => {
                  const d = subDays(new Date(), 6 - i);
                  const v = pedidos.filter(p => isSameDay(new Date(p.created_at), d)).reduce((a,b) => a + b.total, 0);
                  return { name: format(d, 'EEE', {locale: es}), total: v };
                })}>
                  <defs><linearGradient id="colV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false}/>
                  <XAxis dataKey="name" stroke="#444" fontSize={10} fontStyle="bold" axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '15px'}}/>
                  <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={4} fillOpacity={1} fill="url(#colV)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: CONTROL DE MERMA (ACTIVA ✅) */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-fit shadow-2xl">
              <h3 className="text-2xl font-black uppercase italic mb-10 tracking-tighter">Registrar Merma</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase mb-3 block">1. Producto</label>
                  <select value={skuMerma} onChange={(e) => setSkuMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none">
                    <option value="" className="bg-black">-- Seleccionar --</option>
                    {productos.map(p => <option key={p.sku} value={p.sku} className="bg-black">{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase mb-3 block">2. Cantidad</label>
                  <input type="number" placeholder="0.00" value={cantMerma} onChange={(e) => setCantMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-xl font-black outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase mb-3 block">3. Motivo</label>
                  <select value={motivoMerma} onChange={(e) => setMotivoMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none">
                    <option value="Merma Natural" className="bg-black">Merma Natural</option>
                    <option value="Dañado" className="bg-black">Golpeado / Dañado</option>
                    <option value="Vencido" className="bg-black">Vencido</option>
                  </select>
                </div>
                <button onClick={handleRegisterMerma} disabled={isProcessing} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">
                  {isProcessing ? 'PROCESANDO...' : '🗑️ Registrar Pérdida'}
                </button>
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 overflow-hidden">
               <h3 className="text-lg font-black uppercase italic mb-8 tracking-tighter">Historial de Bajas</h3>
               <div className="space-y-4">
                  {mermas.slice(0, 8).map(m => (
                    <div key={m.id} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                       <div><p className="text-xs font-black text-white uppercase">{m.nombre_producto}</p><p className="text-[9px] text-gray-500 font-bold mt-1 uppercase">{format(new Date(m.created_at), 'dd MMM')} • {m.motivo}</p></div>
                       <div className="text-right"><p className="text-sm font-black text-white">-{m.cantidad} {m.unidad}</p><p className="text-[10px] font-black text-red-500">{formatCurrency(m.total_perdida)}</p></div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* --- OTROS MÓDULOS (En construcción inteligente) --- */}
        {[3,5,6,7].includes(activeTab) && (
          <div className="min-h-[500px] flex flex-col items-center justify-center bg-[#0A0A0A] rounded-[60px] border-2 border-dashed border-white/5">
             <div className="text-8xl mb-8 opacity-10">📊</div>
             <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.5em] mb-4">Módulo {tabs.find(t=>t.id===activeTab)?.label}</p>
             <p className="text-xs text-gray-700 font-bold text-center max-w-sm px-6 italic">Calibrando algoritmos de Recharts para procesar Big Data de Amoree.</p>
          </div>
        )}
      </div>

      {/* SELLO DE GARANTÍA */}
      <div className="fixed bottom-10 left-10 z-[100] hidden lg:block">
         <div className="bg-black/90 backdrop-blur-3xl border border-white/10 p-6 rounded-[40px] flex items-center gap-6 shadow-2xl">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-green-600/20">🚀</div>
            <div>
               <p className="text-[12px] font-black text-white uppercase tracking-tighter mb-1">Automatiza con Raul</p>
               <p className="text-[9px] font-bold text-green-500/40 uppercase tracking-[0.4em]">Engineering Partner</p>
            </div>
         </div>
      </div>
    </div>
  );
}
