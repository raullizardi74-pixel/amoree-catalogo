import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format 
} from 'date-fns';
import { es } from 'date-fns/locale/es';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Datos crudos
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);

  // Estados para Registro de Merma
  const [skuMerma, setSkuMerma] = useState('');
  const [cantMerma, setCantMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Merma Natural');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']);
      const { data: pr } = await supabase.from('productos').select('*').order('nombre');
      const { data: m } = await supabase.from('merma').select('*').order('created_at', { ascending: false });
      const { data: c } = await supabase.from('compras').select('*');
      
      if (p) setPedidos(p);
      if (pr) setProductos(pr);
      if (m) setMermas(m);
      if (c) setCompras(c);
    } catch (error) {
      console.error("Error cargando inteligencia:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- DATA ENGINE: COMPARATIVAS Y MÉTRICAS ---
  const getStats = () => {
    const now = new Date();
    
    const hoy = pedidos.filter(p => isSameDay(new Date(p.created_at), now));
    const ayer = pedidos.filter(p => isSameDay(new Date(p.created_at), subDays(now, 1)));
    const semana = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfWeek(now), end: endOfWeek(now) }));
    const semanaPasada = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: subWeeks(startOfWeek(now), 1), end: subWeeks(endOfWeek(now), 1) }));
    const mes = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: startOfMonth(now), end: endOfMonth(now) }));
    const mesPasado = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: subMonths(startOfMonth(now), 1), end: subMonths(endOfMonth(now), 1) }));

    const vHoy = hoy.reduce((a, b) => a + b.total, 0);
    const vAyer = ayer.reduce((a, b) => a + b.total, 0);
    const vSemana = semana.reduce((a, b) => a + b.total, 0);
    const vSemanaPasada = semanaPasada.reduce((a, b) => a + b.total, 0);
    const vMes = mes.reduce((a, b) => a + b.total, 0);
    const vMesPasado = mesPasado.reduce((a, b) => a + b.total, 0);

    return {
      vHoy, vAyer, vSemana, vSemanaPasada, vMes, vMesPasado,
      ticketPromedio: vHoy / (hoy.length || 1),
      vsAyer: vAyer > 0 ? ((vHoy - vAyer) / vAyer) * 100 : 0,
      vsSemana: vSemanaPasada > 0 ? ((vSemana - vSemanaPasada) / vSemanaPasada) * 100 : 0,
      vsMes: vMesPasado > 0 ? ((vMes - vMesPasado) / vMesPasado) * 100 : 0,
    };
  };

  const s = getStats();

  const handleRegisterMerma = async () => {
    const prod = productos.find(p => p.sku === skuMerma);
    const cant = parseFloat(cantMerma);
    if (!prod || isNaN(cant) || cant <= 0) return alert("Selecciona producto y cantidad válida.");

    setIsProcessing(true);
    try {
      const totalPerdida = cant * (prod.costo || 0);
      const { error: eMerma } = await supabase.from('merma').insert([{
        producto_sku: prod.sku,
        nombre_producto: prod.nombre,
        categoria: prod.categoria,
        cantidad: cant,
        unidad: prod.unidad,
        costo_unitario: prod.costo,
        total_perdida: totalPerdida,
        motivo: motivoMerma
      }]);

      if (eMerma) throw eMerma;

      await supabase.from('productos').update({ stock_actual: (prod.stock_actual || 0) - cant }).eq('sku', prod.sku);
      
      setSkuMerma(''); setCantMerma('');
      fetchData();
      alert("✅ Merma registrada e inventario actualizado.");
    } catch (error) {
      alert("Error en registro.");
    } finally {
      setIsProcessing(false);
    }
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black">SINCRONIZANDO INTELIGENCIA...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-6 md:p-10 text-white font-sans selection:bg-green-500/30">
      
      {/* NAVEGACIÓN MASTER */}
      <div className="flex overflow-x-auto gap-3 pb-6 no-scrollbar border-b border-white/5 sticky top-0 bg-[#050505] z-10">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-black shadow-xl scale-105' : 'bg-white/5 text-gray-500 hover:text-white'
            }`}
          >
            <span className="text-lg">{tab.icon}</span> <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* PESTAÑA 1: PANEL EJECUTIVO */}
        {activeTab === 1 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl transition-all hover:border-green-500/20">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Ventas Hoy</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(s.vHoy)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${s.vsAyer >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {s.vsAyer >= 0 ? '▲' : '▼'} {Math.abs(s.vsAyer).toFixed(1)}% vs Ayer
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Semana vs Anterior</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(s.vSemana)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${s.vsSemana >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {s.vsSemana >= 0 ? '▲' : '▼'} {Math.abs(s.vsSemana).toFixed(1)}%
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Mes vs Anterior</p>
                <p className="text-5xl font-black tracking-tighter text-green-500">{formatCurrency(s.vMes)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${s.vsMes >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {s.vsMes >= 0 ? '▲' : '▼'} {Math.abs(s.vsMes).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-green-600 p-12 rounded-[55px] shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Ticket Promedio</p>
                  <p className="text-7xl font-black text-white tracking-tighter">{formatCurrency(s.ticketPromedio)}</p>
                  <p className="text-[9px] font-black text-white/60 uppercase mt-6 tracking-[0.3em]">Cálculo en tiempo real basado en ventas cerradas</p>
               </div>
               <div className="bg-[#0A0A0A] p-12 rounded-[55px] border border-white/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter text-red-500">Inventario Agotado / Crítico</h3>
                  <div className="space-y-4">
                    {productos.filter(p => p.stock_actual <= 5).slice(0, 4).map(p => (
                      <div key={p.sku} className="flex justify-between items-center p-5 bg-white/[0.02] rounded-[24px] border border-white/5 hover:bg-white/[0.05] transition-colors">
                        <span className="text-xs font-bold text-gray-300 uppercase">{p.nombre}</span>
                        <span className={`text-xs font-black ${p.stock_actual <= 0 ? 'text-red-600' : 'text-amber-500'}`}>
                          {p.stock_actual} {p.unidad || 'kg'}
                        </span>
                      </div>
                    ))}
                    {productos.filter(p => p.stock_actual <= 5).length === 0 && (
                      <p className="text-gray-600 text-[10px] font-black uppercase text-center py-10">Stock Saludable</p>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 4: CONTROL DE MERMA */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 shadow-2xl h-fit">
              <h3 className="text-2xl font-black uppercase italic mb-10 tracking-tighter">Registrar Merma</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Producto</label>
                  <select 
                    value={skuMerma} 
                    onChange={(e) => setSkuMerma(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none focus:border-red-500"
                  >
                    <option value="" className="bg-black text-gray-600">-- Seleccionar --</option>
                    {productos.map(p => <option key={p.sku} value={p.sku} className="bg-black">{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Cantidad</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={cantMerma} 
                    onChange={(e) => setCantMerma(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-xl font-black text-white outline-none focus:border-red-500" 
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 block">Motivo</label>
                  <select 
                    value={motivoMerma} 
                    onChange={(e) => setMotivoMerma(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none"
                  >
                    <option value="Merma Natural" className="bg-black">Merma Natural</option>
                    <option value="Dañado" className="bg-black">Golpeado / Dañado</option>
                    <option value="Vencido" className="bg-black">Vencido</option>
                  </select>
                </div>
                <button 
                  onClick={handleRegisterMerma} 
                  disabled={isProcessing}
                  className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-600/20 active:scale-95 transition-all"
                >
                  {isProcessing ? 'REGISTRANDO...' : '🗑️ Registrar Pérdida'}
                </button>
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                <h3 className="text-lg font-black uppercase italic mb-8 tracking-tighter">Historial de Pérdidas</h3>
                <div className="space-y-4">
                  {mermas.slice(0, 10).map(m => (
                    <div key={m.id} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-red-500/20 transition-all">
                       <div>
                          <p className="text-xs font-black text-white uppercase">{m.nombre_producto}</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">{format(new Date(m.created_at), 'dd MMM, HH:mm')} • {m.motivo}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-sm font-black text-white">-{m.cantidad} {m.unidad || 'kg'}</p>
                          <p className="text-[10px] font-black text-red-500">{formatCurrency(m.total_perdida)}</p>
                       </div>
                    </div>
                  ))}
                  {mermas.length === 0 && <p className="text-center py-20 text-gray-600 font-black uppercase text-xs">Sin registros de merma</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OTROS MÓDULOS - ESTRUCTURA DE ESPERA */}
        {[2,3,5,6,7].includes(activeTab) && (
          <div className="min-h-[500px] flex flex-col items-center justify-center bg-[#0A0A0A] rounded-[60px] border-2 border-dashed border-white/5">
             <div className="text-8xl mb-8 opacity-10">📊</div>
             <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.5em] mb-4">Módulo {tabs.find(t=>t.id===activeTab)?.label}</p>
             <p className="text-xs text-gray-700 font-bold text-center max-w-sm px-6">Estamos inyectando los algoritmos de Recharts para procesar los datos históricos de Amoree.</p>
          </div>
        )}
      </div>

      {/* FOOTER SWISS MADE */}
      <div className="fixed bottom-10 left-10 z-[100]">
         <div className="bg-black/80 backdrop-blur-3xl border border-white/10 p-6 rounded-[40px] flex items-center gap-6 shadow-2xl">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-green-600/20 animate-pulse">🚀</div>
            <div>
               <p className="text-[12px] font-black text-white uppercase tracking-tighter leading-none mb-1">Automatiza con Raul</p>
               <p className="text-[9px] font-bold text-green-500/40 uppercase tracking-[0.4em]">Engineering Partner</p>
            </div>
         </div>
      </div>
    </div>
  );
}
