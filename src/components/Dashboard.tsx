import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell 
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, isSameDay, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  subWeeks, subMonths, format, parseISO 
} from 'date-fns';
import { es } from 'date-fns/locale/es';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE FILTRO MAESTRO ---
  const [rango, setRango] = useState<'hoy' | '7d' | '30d' | 'custom'>('hoy');
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);

  // Registro de Merma
  const [skuMerma, setSkuMerma] = useState('');
  const [cantMerma, setCantMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Merma Natural');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [pRes, prRes, mRes] = await Promise.all([
        supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']),
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('merma').select('*').order('created_at', { ascending: false })
      ]);
      if (pRes.data) setPedidos(pRes.data);
      if (prRes.data) setProductos(prRes.data);
      if (mRes.data) setMermas(mRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  // --- MOTOR DE FILTRADO GLOBAL ---
  const dataFiltrada = useMemo(() => {
    const ahora = new Date();
    let inicio: Date, fin: Date;

    if (rango === 'hoy') {
      inicio = startOfDay(ahora);
      fin = endOfDay(ahora);
    } else if (rango === '7d') {
      inicio = startOfDay(subDays(ahora, 7));
      fin = endOfDay(ahora);
    } else if (rango === '30d') {
      inicio = startOfDay(subDays(ahora, 30));
      fin = endOfDay(ahora);
    } else {
      inicio = startOfDay(parseISO(fechaInicio));
      fin = endOfDay(parseISO(fechaFin));
    }

    const pedidosFiltrados = pedidos.filter(p => 
      isWithinInterval(new Date(p.created_at), { start: inicio, end: fin })
    );

    const mermasFiltradas = mermas.filter(m => 
      isWithinInterval(new Date(m.created_at), { start: inicio, end: fin })
    );

    // Comparativo (Periodo anterior)
    const duracion = fin.getTime() - inicio.getTime();
    const inicioAnt = new Date(inicio.getTime() - duracion - 1000);
    const finAnt = new Date(inicio.getTime() - 1000);
    const pedidosAnt = pedidos.filter(p => 
      isWithinInterval(new Date(p.created_at), { start: inicioAnt, end: finAnt })
    );

    const vTotal = pedidosFiltrados.reduce((a, b) => a + b.total, 0);
    const vAnt = pedidosAnt.reduce((a, b) => a + b.total, 0);
    const mTotal = mermasFiltradas.reduce((a, b) => a + (b.total_perdida || 0), 0);

    return {
      pedidos: pedidosFiltrados,
      mermas: mermasFiltradas,
      ventaTotal: vTotal,
      vsAnterior: vAnt > 0 ? ((vTotal - vAnt) / vAnt) * 100 : 0,
      mermaTotal: mTotal,
      ticket: vTotal / (pedidosFiltrados.length || 1),
      count: pedidosFiltrados.length
    };
  }, [rango, fechaInicio, fechaFin, pedidos, mermas]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black">CARGANDO CONTROL MAESTRO...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-8 text-white font-sans selection:bg-green-500/30">
      
      {/* 🎯 BOTONES MAESTROS Y CALENDARIO */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5 shadow-2xl">
        <div className="flex bg-white/5 p-1.5 rounded-2xl gap-2">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: '7d', label: '7 Días' },
            { id: '30d', label: '30 Días' },
            { id: 'custom', label: 'Calendario' }
          ].map(b => (
            <button
              key={b.id}
              onClick={() => setRango(b.id as any)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                rango === b.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {rango === 'custom' && (
          <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300">
            <input 
              type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-green-500 outline-none"
            />
            <span className="text-gray-600 font-black">→</span>
            <input 
              type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-green-500 outline-none"
            />
          </div>
        )}

        <div className="hidden lg:block text-right">
          <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.4em]">Amoree Titanium OS</p>
          <p className="text-[10px] font-bold text-green-500 uppercase">{format(new Date(), "eeee dd 'de' MMMM", { locale: es })}</p>
        </div>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="flex overflow-x-auto gap-3 pb-6 border-b border-white/5 mb-10 no-scrollbar">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-black scale-105' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
            <span className="text-lg">{tab.icon}</span> <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENIDO DINÁMICO */}
      <div className="animate-in fade-in duration-700">
        
        {activeTab === 1 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Venta Periodo</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(dataFiltrada.ventaTotal)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${dataFiltrada.vsAnterior >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {dataFiltrada.vsAnterior >= 0 ? '▲' : '▼'} {Math.abs(dataFiltrada.vsAnterior).toFixed(1)}% vs anterior
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Ticket Promedio</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(dataFiltrada.ticket)}</p>
                <p className="text-[9px] text-gray-600 mt-4 font-bold uppercase tracking-widest">{dataFiltrada.count} pedidos realizados</p>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Merma Periodo</p>
                <p className="text-5xl font-black text-red-500 tracking-tighter">{formatCurrency(dataFiltrada.mermaTotal)}</p>
                <p className="text-[9px] text-gray-600 mt-4 font-bold uppercase tracking-widest">Impacto: {((dataFiltrada.mermaTotal / (dataFiltrada.ventaTotal || 1)) * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-green-600 p-12 rounded-[55px] shadow-2xl">
                  <h3 className="text-xl font-black text-white/50 uppercase italic mb-8">Rendimiento Operativo</h3>
                  <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-6">
                    <span className="text-xs font-black uppercase text-white/70">Margen Estimado</span>
                    <span className="text-4xl font-black text-white">25%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-white/70">Utilidad Proyectada</span>
                    <span className="text-4xl font-black text-white">{formatCurrency(dataFiltrada.ventaTotal * 0.25 - dataFiltrada.mermaTotal)}</span>
                  </div>
               </div>
               <div className="bg-[#0A0A0A] p-12 rounded-[55px] border border-white/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter">🔥 Top Productos</h3>
                  <div className="space-y-4">
                    {productos.filter(p => p.stock_actual < 10).slice(0, 4).map(p => (
                      <div key={p.sku} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <span className="text-xs font-bold text-gray-400 uppercase">{p.nombre}</span>
                        <span className="text-xs font-black text-amber-500">{p.stock_actual} {p.unidad}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 shadow-2xl h-fit">
              <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter">Registrar Merma</h3>
              <div className="space-y-6">
                <select value={skuMerma} onChange={(e) => setSkuMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none">
                  <option value="" className="bg-black">-- Seleccionar --</option>
                  {productos.map(p => <option key={p.sku} value={p.sku} className="bg-black">{p.nombre}</option>)}
                </select>
                <input type="number" placeholder="Cantidad" value={cantMerma} onChange={(e) => setCantMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-xl font-black text-white outline-none" />
                <button 
                  onClick={async () => {
                    const prod = productos.find(p => p.sku === skuMerma);
                    if (!prod || !cantMerma) return alert("Selecciona producto y cantidad");
                    const perdida = parseFloat(cantMerma) * (prod.costo || 0);
                    const { error } = await supabase.from('merma').insert([{
                      producto_sku: prod.sku, nombre_producto: prod.nombre, cantidad: parseFloat(cantMerma),
                      unidad: prod.unidad, costo_unitario: prod.costo, total_perdida: perdida, motivo: motivoMerma
                    }]);
                    if (!error) {
                      await supabase.from('productos').update({ stock_actual: (prod.stock_actual || 0) - parseFloat(cantMerma) }).eq('sku', prod.sku);
                      alert("Merma registrada ✅"); setCantMerma(''); setSkuMerma('');
                    }
                  }} 
                  className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl"
                >
                  🗑️ Registrar Pérdida
                </button>
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
               <h3 className="text-lg font-black uppercase italic mb-8 tracking-tighter">Historial Periodo</h3>
               <div className="space-y-4">
                  {dataFiltrada.mermas.slice(0, 10).map(m => (
                    <div key={m.id} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                       <div><p className="text-xs font-black text-white uppercase">{m.nombre_producto}</p><p className="text-[9px] text-gray-500 font-bold uppercase mt-1">{format(new Date(m.created_at), 'dd MMM')} • {m.motivo}</p></div>
                       <div className="text-right"><p className="text-sm font-black text-white">-{m.cantidad} {m.unidad}</p><p className="text-[10px] font-black text-red-500">{formatCurrency(m.total_perdida)}</p></div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const tabs = [
  { id: 1, label: 'Ejecutivo', icon: '🎯' },
  { id: 2, label: 'Ventas', icon: '💰' },
  { id: 3, label: 'Inventario', icon: '📦' },
  { id: 4, label: 'Merma', icon: '🗑️' },
  { id: 5, label: 'Rentabilidad', icon: '📊' },
  { id: 6, label: 'Compras', icon: '🛒' },
  { id: 7, label: 'Alertas', icon: '🚨' }
];
