import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, isSameDay, 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  subWeeks, subMonths, format, parseISO, getHours
} from 'date-fns';
import { es } from 'date-fns/locale/es';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE FILTRO MAESTRO ---
  const [rango, setRango] = useState<'hoy' | '7d' | '30d' | 'custom'>('7d');
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
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

  // --- MOTOR DE INTELIGENCIA DE DATOS (RECALCULA TODO AL CAMBIAR FILTRO) ---
  const dataEngine = useMemo(() => {
    const ahora = new Date();
    let inicio: Date, fin: Date;

    if (rango === 'hoy') { inicio = startOfDay(ahora); fin = endOfDay(ahora); }
    else if (rango === '7d') { inicio = startOfDay(subDays(ahora, 7)); fin = endOfDay(ahora); }
    else if (rango === '30d') { inicio = startOfDay(subDays(ahora, 30)); fin = endOfDay(ahora); }
    else { inicio = startOfDay(parseISO(fechaInicio)); fin = endOfDay(parseISO(fechaFin)); }

    const pFiltrados = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: inicio, end: fin }));
    const mFiltradas = mermas.filter(m => isWithinInterval(new Date(m.created_at), { start: inicio, end: fin }));

    // 1. Ventas por Categoría
    const catData: any = {};
    pFiltrados.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      const cat = i.categoria || 'Otros';
      catData[cat] = (catData[cat] || 0) + (i.quantity * (i.precio_venta || i['$ VENTA'] || 0));
    }));
    const chartCategorias = Object.entries(catData).map(([name, value]) => ({ name, value }));

    // 2. Ventas por Horario (8am - 8pm)
    const horasData = Array.from({ length: 13 }, (_, i) => ({ hora: `${i + 8}:00`, total: 0 }));
    pFiltrados.forEach(p => {
      const h = getHours(new Date(p.created_at));
      if (h >= 8 && h <= 20) horasData[h - 8].total += p.total;
    });

    // 3. Ventas por Método de Pago
    const pagoData: any = {};
    pFiltrados.forEach(p => {
      const metodo = p.metodo_pago || 'Efectivo';
      pagoData[metodo] = (pagoData[metodo] || 0) + p.total;
    });
    const chartPagos = Object.entries(pagoData).map(([name, value]) => ({ name, value }));

    // 4. Comparativo
    const duracion = fin.getTime() - inicio.getTime();
    const pAnterior = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { 
      start: new Date(inicio.getTime() - duracion), 
      end: new Date(inicio.getTime()) 
    }));

    const vTotal = pFiltrados.reduce((a, b) => a + b.total, 0);
    const vAnt = pAnterior.reduce((a, b) => a + b.total, 0);

    return {
      pedidos: pFiltrados,
      ventaTotal: vTotal,
      vsAnterior: vAnt > 0 ? ((vTotal - vAnt) / vAnt) * 100 : 0,
      ticket: vTotal / (pFiltrados.length || 1),
      chartCategorias,
      chartHoras: horasData,
      chartPagos,
      mermaTotal: mFiltradas.reduce((a, b) => a + (b.total_perdida || 0), 0)
    };
  }, [rango, fechaInicio, fechaFin, pedidos, mermas]);

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black">SINCRO TITANIUM...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white font-sans">
      
      {/* --- BOTONES MAESTROS --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5 shadow-2xl">
        <div className="flex bg-white/5 p-1.5 rounded-2xl gap-2 overflow-x-auto no-scrollbar">
          {['hoy', '7d', '30d', 'custom'].map(id => (
            <button key={id} onClick={() => setRango(id as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rango === id ? 'bg-white text-black' : 'text-gray-500'}`}>{id}</button>
          ))}
        </div>
        {rango === 'custom' && (
          <div className="flex items-center gap-3 animate-in fade-in zoom-in">
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-green-500 outline-none" />
            <span className="text-gray-700">→</span>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-green-500 outline-none" />
          </div>
        )}
      </div>

      {/* --- TABS --- */}
      <div className="flex overflow-x-auto gap-3 pb-6 border-b border-white/5 mb-10 no-scrollbar">
        {[
          { id: 1, label: 'Ejecutivo', icon: '🎯' },
          { id: 2, label: 'Ventas', icon: '💰' },
          { id: 3, label: 'Inventario', icon: '📦' },
          { id: 4, label: 'Merma', icon: '🗑️' },
          { id: 5, label: 'Rentabilidad', icon: '📊' },
          { id: 6, label: 'Compras', icon: '🛒' },
          { id: 7, label: 'Alertas', icon: '🚨' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-black scale-105' : 'bg-white/5 text-gray-500'}`}>
            <span className="text-lg">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <main className="animate-in fade-in duration-700">
        
        {/* --- PESTAÑA 1: EJECUTIVO --- */}
        {activeTab === 1 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Venta Total</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(dataEngine.ventaTotal)}</p>
                <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${dataEngine.vsAnterior >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {dataEngine.vsAnterior >= 0 ? '▲' : '▼'} {Math.abs(dataEngine.vsAnterior).toFixed(1)}% vs anterior
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Ticket Promedio</p>
                <p className="text-5xl font-black tracking-tighter">{formatCurrency(dataEngine.ticket)}</p>
                <p className="text-[9px] text-gray-600 mt-4 font-bold uppercase">{dataEngine.pedidos.length} transacciones</p>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 shadow-2xl">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Impacto Merma</p>
                <p className="text-5xl font-black text-red-500 tracking-tighter">{formatCurrency(dataEngine.mermaTotal)}</p>
                <p className="text-[9px] text-gray-600 mt-4 font-bold uppercase">{((dataEngine.mermaTotal / (dataEngine.ventaTotal || 1)) * 100).toFixed(1)}% de la venta</p>
              </div>
            </div>
          </div>
        )}

        {/* --- PESTAÑA 2: VENTAS (DETALLADO) --- */}
        {activeTab === 2 && (
          <div className="space-y-10">
            {/* Gráfico de Categorías y Métodos de Pago */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
                <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Ventas por Categoría</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie data={dataEngine.chartCategorias} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {dataEngine.chartCategorias.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '15px'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
                <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Métodos de Pago</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={dataEngine.chartPagos} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="#666" fontSize={10} fontStyle="bold" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '15px'}} />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                      {dataEngine.chartPagos.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mapa de Calor de Horarios */}
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
              <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Intensidad de Ventas por Horario</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={dataEngine.chartHoras}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="hora" stroke="#444" fontSize={10} fontStyle="bold" axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '15px'}} />
                  <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                    {dataEngine.chartHoras.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.total > dataEngine.ventaTotal / 10 ? '#22c55e' : '#22c55e33'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- PESTAÑA 4: MERMA (SE MANTIENE FUNCIONAL) --- */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-fit">
              <h3 className="text-2xl font-black uppercase italic mb-8">Registrar Merma</h3>
              <div className="space-y-6">
                <select value={skuMerma} onChange={(e) => setSkuMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none">
                  <option value="" className="bg-black">-- Seleccionar --</option>
                  {productos.map(p => <option key={p.sku} value={p.sku} className="bg-black">{p.nombre}</option>)}
                </select>
                <input type="number" placeholder="Cantidad" value={cantMerma} onChange={(e) => setCantMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-xl font-black outline-none" />
                <button onClick={async () => {
                  const p = productos.find(x => x.sku === skuMerma);
                  if(!p || !cantMerma) return;
                  const { error } = await supabase.from('merma').insert([{ 
                    producto_sku: p.sku, nombre_producto: p.nombre, cantidad: parseFloat(cantMerma), 
                    unidad: p.unidad, costo_unitario: p.costo, total_perdida: parseFloat(cantMerma)*p.costo, 
                    motivo: motivoMerma, categoria: p.categoria 
                  }]);
                  if(!error) {
                    await supabase.from('productos').update({ stock_actual: (p.stock_actual || 0) - parseFloat(cantMerma) }).eq('sku', p.sku);
                    alert("Merma registrada ✅"); setCantMerma(''); setSkuMerma('');
                  }
                }} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl">🗑️ Registrar</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
