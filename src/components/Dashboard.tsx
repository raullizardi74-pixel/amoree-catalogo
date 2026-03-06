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
  subWeeks, subMonths, format, parseISO, getHours, differenceInDays
} from 'date-fns';
import { es } from 'date-fns/locale/es';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE FILTRO MAESTRO ---
  const [rango, setRango] = useState<'hoy' | '7d' | '30d' | 'custom'>('7d');
  const [fechaInicio, setFechaInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));

  // --- REPOSITORIO DE DATOS ---
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);

  // Estados para Registro de Merma (Pestaña 4)
  const [skuMerma, setSkuMerma] = useState('');
  const [cantMerma, setCantMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Merma Natural');

  // Metas de Rentabilidad (Pestaña 5)
  const GOALS: any = { 'Verduras': 35, 'Frutas': 35, 'Cremería': 25, 'Abarrotes': 15 };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [pRes, prRes, mRes, cRes] = await Promise.all([
        supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']),
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('merma').select('*').order('created_at', { ascending: false }),
        supabase.from('compras').select('*').order('created_at', { ascending: false })
      ]);
      if (pRes.data) setPedidos(pRes.data);
      if (prRes.data) setProductos(prRes.data);
      if (mRes.data) setMermas(mRes.data);
      if (cRes.data) setCompras(cRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  // --- MASTER DATA ENGINE (PROCESAMIENTO TOTAL) ---
  const engine = useMemo(() => {
    const ahora = new Date();
    let inicio: Date, fin: Date;

    if (rango === 'hoy') { inicio = startOfDay(ahora); fin = endOfDay(ahora); }
    else if (rango === '7d') { inicio = startOfDay(subDays(ahora, 7)); fin = endOfDay(ahora); }
    else if (rango === '30d') { inicio = startOfDay(subDays(ahora, 30)); fin = endOfDay(ahora); }
    else { inicio = startOfDay(parseISO(fechaInicio)); fin = endOfDay(parseISO(fechaFin)); }

    const pRange = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: inicio, end: fin }));
    const mRange = mermas.filter(m => isWithinInterval(new Date(m.created_at), { start: inicio, end: fin }));
    const cRange = compras.filter(c => isWithinInterval(new Date(c.created_at), { start: inicio, end: fin }));

    // 1. Cálculos de Venta y Ticket
    const vTotal = pRange.reduce((a, b) => a + b.total, 0);
    const ticket = vTotal / (pRange.length || 1);

    // 2. Análisis de Categorías (Ventas)
    const catData: any = {};
    pRange.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      const c = i.categoria || 'Otros';
      catData[c] = (catData[c] || 0) + (i.quantity * (i.precio_venta || i['$ VENTA'] || 0));
    }));
    const chartCategorias = Object.entries(catData).map(([name, value]) => ({ name, value }));

    // 3. Análisis de Rentabilidad (Margen Real)
    let costoTotalRange = 0;
    pRange.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      costoTotalRange += (i.costo || 0) * i.quantity;
    }));
    const margenBruto = vTotal > 0 ? ((vTotal - costoTotalRange) / vTotal) * 100 : 0;

    // 4. Top 5 Productos (Basado en cantidad vendida)
    const prodCounts: any = {};
    pRange.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      prodCounts[i.nombre] = (prodCounts[i.nombre] || 0) + i.quantity;
    }));
    const top5 = Object.entries(prodCounts).sort(([,a]:any, [,b]:any) => b - a).slice(0, 5);

    // 5. Inventario: Rotación y Días
    const numDias = differenceInDays(fin, inicio) || 1;
    const invData = productos.map(p => {
      const vendido = pRange.reduce((acc, ped) => acc + (ped.detalle_pedido?.filter((i:any) => i.sku === p.sku).reduce((s:any, i:any) => s + i.quantity, 0) || 0), 0);
      const vtaDiaria = vendido / numDias;
      const diasInv = vtaDiaria > 0 ? p.stock_actual / vtaDiaria : 0;
      return { ...p, vtaDiaria, diasInv, rotation: vtaDiaria / (p.stock_actual || 1) };
    });

    return {
      pRange, mRange, cRange, vTotal, ticket, chartCategorias, margenBruto, top5, invData,
      mermaTotal: mRange.reduce((a, b) => a + (b.total_perdida || 0), 0),
      comprasTotal: cRange.reduce((a, b) => a + (b.total_compra || 0), 0)
    };
  }, [rango, fechaInicio, fechaFin, pedidos, productos, mermas, compras]);

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

  // Función para Tooltip corregido (Contraste alto)
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-white/10 p-4 rounded-2xl shadow-2xl">
          <p className="text-[10px] font-black text-gray-500 uppercase mb-1">{label}</p>
          <p className="text-sm font-black text-green-500">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black tracking-[0.5em] animate-pulse">CARGANDO TITANIUM INTELLIGENCE...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white font-sans selection:bg-green-500/30">
      
      {/* --- SELECTOR DE TIEMPO MAESTRO --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5">
        <div className="flex bg-white/5 p-1.5 rounded-2xl gap-2 overflow-x-auto no-scrollbar">
          {['hoy', '7d', '30d', 'custom'].map(id => (
            <button key={id} onClick={() => setRango(id as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rango === id ? 'bg-white text-black scale-105 shadow-xl' : 'text-gray-500'}`}>{id}</button>
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

      {/* --- NAVEGACIÓN DE 7 PESTAÑAS --- */}
      <div className="flex overflow-x-auto gap-3 pb-6 border-b border-white/5 mb-10 no-scrollbar sticky top-0 bg-[#050505] z-50">
        {[
          { id: 1, label: 'Ejecutivo', icon: '🎯' },
          { id: 2, label: 'Ventas', icon: '💰' },
          { id: 3, label: 'Inventario', icon: '📦' },
          { id: 4, label: 'Merma', icon: '🗑️' },
          { id: 5, label: 'Rentabilidad', icon: '📊' },
          { id: 6, label: 'Compras', icon: '🛒' },
          { id: 7, label: 'Alertas', icon: '🚨' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black scale-105 shadow-xl' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
            <span className="text-lg">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <main className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* (1) EJECUTIVO: REESTABLECIDO */}
        {activeTab === 1 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Venta Total</p>
                <p className="text-4xl font-black">{formatCurrency(engine.vTotal)}</p>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Ticket Promedio</p>
                <p className="text-4xl font-black">{formatCurrency(engine.ticket)}</p>
              </div>
              <div className="bg-red-600/5 p-8 rounded-[40px] border border-red-600/10">
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3">Impacto de Merma</p>
                <p className="text-4xl font-black text-red-500">{formatCurrency(engine.mermaTotal)}</p>
              </div>
              <div className="bg-green-600/5 p-8 rounded-[40px] border border-green-600/10">
                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-3">Margen Bruto Real</p>
                <p className="text-4xl font-black text-green-500">{engine.margenBruto.toFixed(1)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter">🔥 Top 5 Productos (Día)</h3>
                  <div className="space-y-4">
                    {engine.top5.map(([name, qty]: any) => (
                      <div key={name} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <span className="text-xs font-bold text-gray-400 uppercase">{name}</span>
                        <span className="text-xs font-black text-white">{qty.toFixed(2)} kg/pza</span>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="bg-green-600 p-12 rounded-[55px] flex flex-col justify-center">
                  <p className="text-[10px] font-black text-white/50 uppercase mb-4 tracking-widest">Estado del Negocio</p>
                  <p className="text-6xl font-black text-white italic tracking-tighter uppercase">Titanium <br/> Optimizado</p>
               </div>
            </div>
          </div>
        )}

        {/* (2) VENTAS: CORREGIDO COLORES */}
        {activeTab === 2 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
                <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Ventas por Categoría</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie data={engine.chartCategorias} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name}) => name}>
                      {engine.chartCategorias.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '15px'}} itemStyle={{color: '#fff'}} />
                    <Legend wrapperStyle={{fontSize: '10px', color: '#fff'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
                <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Método de Pago</h3>
                <ResponsiveContainer width="100%" height="90%">
                   <BarChart data={engine.chartPagos || []} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '15px'}} />
                      <Bar dataKey="value" fill="#22c55e" radius={[0, 10, 10, 0]} />
                   </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* (3) INVENTARIO: RECONSTRUIDO */}
        {activeTab === 3 && (
          <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
            <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter">Control de Rotación y Existencias</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-gray-500 uppercase border-b border-white/5 pb-4">
                    <th className="pb-6">Artículo</th>
                    <th className="pb-6">Stock Actual</th>
                    <th className="pb-6">Días de Inventario</th>
                    <th className="pb-6">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {engine.invData.map(p => (
                    <tr key={p.sku} className="group hover:bg-white/[0.02]">
                      <td className="py-6 font-bold text-xs uppercase">{p.nombre}</td>
                      <td className="py-6 font-black text-sm">{p.stock_actual} {p.unidad}</td>
                      <td className="py-6 font-black text-sm text-green-500">{p.diasInv.toFixed(1)} días</td>
                      <td className="py-6">
                         {p.stock_actual <= 0 ? <span className="bg-red-600 px-3 py-1 rounded-full text-[8px] font-black">AGOTADO</span> :
                          p.diasInv < 1 ? <span className="bg-amber-600 px-3 py-1 rounded-full text-[8px] font-black">REABASTECER</span> :
                          <span className="bg-green-600 px-3 py-1 rounded-full text-[8px] font-black">SALUDABLE</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* (4) MERMA: HISTORIAL REINTEGRADO */}
        {activeTab === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-fit shadow-2xl">
              <h3 className="text-2xl font-black uppercase italic mb-10 tracking-tighter">Registrar Merma</h3>
              <div className="space-y-6">
                <select value={skuMerma} onChange={(e) => setSkuMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-sm font-black text-white outline-none">
                  <option value="" className="bg-black text-gray-600">-- Seleccionar --</option>
                  {productos.map(p => <option key={p.sku} value={p.sku} className="bg-black">{p.nombre}</option>)}
                </select>
                <input type="number" placeholder="Cantidad" value={cantMerma} onChange={(e) => setCantMerma(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-xl font-black outline-none" />
                <button onClick={async () => {
                  const p = productos.find(x => x.sku === skuMerma);
                  if(!p || !cantMerma) return;
                  const perdida = parseFloat(cantMerma) * (p.costo || 0);
                  await supabase.from('merma').insert([{ 
                    producto_sku: p.sku, nombre_producto: p.nombre, cantidad: parseFloat(cantMerma), 
                    unidad: p.unidad, costo_unitario: p.costo, total_perdida: perdida, 
                    motivo: motivoMerma, categoria: p.categoria 
                  }]);
                  await supabase.from('productos').update({ stock_actual: (p.stock_actual || 0) - parseFloat(cantMerma) }).eq('sku', p.sku);
                  alert("Merma registrada ✅"); setCantMerma(''); setSkuMerma('');
                }} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest">🗑️ Registrar</button>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px] overflow-y-auto">
                <h3 className="text-sm font-black uppercase italic mb-8">Últimos Registros</h3>
                {engine.mRange.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-5 bg-white/[0.02] rounded-3xl mb-3 border border-white/5">
                    <div>
                      <p className="text-xs font-black uppercase">{m.nombre_producto}</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase">{format(new Date(m.created_at), 'dd MMM')} • {m.motivo}</p>
                    </div>
                    <p className="text-sm font-black text-red-500">-{formatCurrency(m.total_perdida)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* (5) RENTABILIDAD: ACTIVADO */}
        {activeTab === 5 && (
          <div className="space-y-10">
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
              <h3 className="text-sm font-black uppercase italic mb-8">Margen Bruto Real vs Objetivo</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={engine.chartCategorias}>
                  <XAxis dataKey="name" stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{backgroundColor: '#111', border: 'none', borderRadius: '15px'}} />
                  <Bar dataKey="value" fill="#22c55e" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {Object.entries(GOALS).map(([cat, goal]:any) => (
                 <div key={cat} className="bg-white/5 p-8 rounded-[40px] border border-white/10 text-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase mb-2">{cat}</p>
                    <p className="text-3xl font-black">Meta: {goal}%</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* (6) COMPRAS VS VENTAS: ACTIVADO */}
        {activeTab === 6 && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                 <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total Compras (Periodo)</p>
                 <p className="text-5xl font-black text-blue-500">{formatCurrency(engine.comprasTotal)}</p>
                 <p className="text-[9px] text-gray-600 mt-4 font-bold uppercase">Impacto sobre Venta: {((engine.comprasTotal / (engine.vTotal || 1)) * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                 <h3 className="text-sm font-black uppercase italic mb-8">Top Proveedores</h3>
                 {engine.cRange.slice(0, 3).map(c => (
                   <div key={c.id} className="flex justify-between p-4 bg-white/[0.02] rounded-2xl mb-2">
                     <span className="text-[10px] font-black uppercase">{c.proveedor || 'General'}</span>
                     <span className="text-[10px] font-black">{formatCurrency(c.total_compra)}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        )}

        {/* (7) ALERTAS: ACTIVADO */}
        {activeTab === 7 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productos.filter(p => p.stock_actual <= 0).map(p => (
              <div key={p.sku} className="bg-red-600/10 border-2 border-red-600 p-8 rounded-[40px]">
                <p className="text-[9px] font-black text-red-500 uppercase mb-2">Alerta de Agotado</p>
                <h4 className="text-xl font-black uppercase mb-4">{p.nombre}</h4>
                <p className="text-xs font-bold text-gray-400">Revisar proveedor para resurtido inmediato.</p>
              </div>
            ))}
            {engine.invData.filter(p => p.diasInv > 30).slice(0, 3).map(p => (
              <div key={p.sku} className="bg-amber-600/10 border-2 border-amber-600 p-8 rounded-[40px]">
                <p className="text-[9px] font-black text-amber-500 uppercase mb-2">Sobre-Inventario (Mala Rotación)</p>
                <h4 className="text-xl font-black uppercase mb-4">{p.nombre}</h4>
                <p className="text-xs font-bold text-gray-400">Días de Inventario: {p.diasInv.toFixed(1)}</p>
              </div>
            ))}
            {engine.invData.filter(p => p.diasInv < 1 && p.stock_actual > 0).map(p => (
              <div key={p.sku} className="bg-blue-600/10 border-2 border-blue-600 p-8 rounded-[40px]">
                <p className="text-[9px] font-black text-blue-500 uppercase mb-2">Abasto Crítico</p>
                <h4 className="text-xl font-black uppercase mb-4">{p.nombre}</h4>
                <p className="text-xs font-bold text-gray-400">Menos de 24h de stock según venta diaria.</p>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* FOOTER SWISS MADE */}
      <div className="fixed bottom-10 left-10 z-[100] hidden lg:block">
         <div className="bg-black/90 backdrop-blur-3xl border border-white/10 p-6 rounded-[40px] flex items-center gap-6 shadow-2xl">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-3xl shadow-xl shadow-green-600/20">🚀</div>
            <div>
               <p className="text-[12px] font-black text-white uppercase tracking-tighter mb-1 leading-none">Automatiza con Raul</p>
               <p className="text-[9px] font-bold text-green-500/40 uppercase tracking-[0.4em]">Engineering Partner</p>
            </div>
         </div>
      </div>
    </div>
  );
}
