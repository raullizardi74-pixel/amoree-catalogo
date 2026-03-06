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

// Función auxiliar para forzar 0 decimales en moneda
const formatCurrencyZero = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
};

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

  // Registro de Merma
  const [skuMerma, setSkuMerma] = useState('');
  const [cantMerma, setCantMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Merma Natural');

  // Metas Fijas por Categoría
  const GOALS: any = { 'Verduras': 35, 'Frutas': 35, 'Cremería': 25, 'Abarrotes': 15 };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
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
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  // --- MASTER DATA ENGINE ---
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

    const vTotal = Math.round(pRange.reduce((a, b) => a + b.total, 0));
    const mTotal = Math.round(mRange.reduce((a, b) => a + (b.total_perdida || 0), 0));

    // Análisis por Categoría
    const catAnalysis: any = {};
    pRange.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      const c = i.categoria || 'Otros';
      if (!catAnalysis[c]) catAnalysis[c] = { venta: 0, costo: 0 };
      catAnalysis[c].venta += i.quantity * (i.precio_venta || i['$ VENTA'] || 0);
      catAnalysis[c].costo += i.quantity * (i.costo || 0);
    }));

    const chartCategorias = Object.entries(catAnalysis).map(([name, data]: any) => ({
      name,
      value: Math.round(data.venta),
      margin: data.venta > 0 ? Math.round(((data.venta - data.costo) / data.venta) * 100) : 0
    }));

    // Métodos de Pago
    const pagoData: any = {};
    pRange.forEach(p => {
      const m = p.metodo_pago || 'Efectivo';
      pagoData[m] = (pagoData[m] || 0) + p.total;
    });
    const chartPagos = Object.entries(pagoData).map(([name, value]) => ({ name, value: Math.round(value as number) }));

    // Ventas por Horario
    const horasData = Array.from({ length: 13 }, (_, i) => ({ hora: `${i + 8}:00`, total: 0 }));
    pRange.forEach(p => {
      const h = getHours(new Date(p.created_at));
      if (h >= 8 && h <= 20) horasData[h - 8].total += p.total;
    });

    // Inventario
    const numDias = differenceInDays(fin, inicio) || 1;
    const invData = productos.map(p => {
      const vendido = pRange.reduce((acc, ped) => acc + (ped.detalle_pedido?.filter((i:any) => i.sku === p.sku).reduce((s:any, i:any) => s + i.quantity, 0) || 0), 0);
      const vtaDiaria = vendido / numDias;
      const diasInv = vtaDiaria > 0 ? p.stock_actual / vtaDiaria : 0;
      return { ...p, stock_actual: Math.round(p.stock_actual), diasInv: Math.round(diasInv) };
    });

    // Comparativo Periodo Anterior
    const duracion = fin.getTime() - inicio.getTime();
    const pAnt = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: new Date(inicio.getTime() - duracion), end: new Date(inicio.getTime()) }));
    const vAnt = pAnt.reduce((a, b) => a + b.total, 0);

    // Top 5
    const prodCounts: any = {};
    pRange.forEach(p => p.detalle_pedido?.forEach((i: any) => {
      prodCounts[i.nombre] = (prodCounts[i.nombre] || 0) + i.quantity;
    }));
    const top5 = Object.entries(prodCounts).sort(([,a]:any, [,b]:any) => b - a).slice(0, 5).map(([n, q]) => [n, Math.round(q as number)]);

    return {
      vTotal, mTotal, ticket: Math.round(vTotal / (pRange.length || 1)), count: pRange.length,
      vsAnterior: Math.round(vAnt > 0 ? ((vTotal - vAnt) / vAnt) * 100 : 0),
      chartCategorias, chartPagos, chartHoras: horasData, top5, invData,
      comprasTotal: Math.round(cRange.reduce((a, b) => a + (b.total_compra || 0), 0)),
      cRange, mRange
    };
  }, [rango, fechaInicio, fechaFin, pedidos, productos, mermas, compras]);

  // --- FUNCIÓN DE EXPORTACIÓN CSV PARA IA ---
  const exportCSV = () => {
    if (engine.pRange.length === 0) return alert("No hay datos para exportar");

    const headers = ["Fecha", "Categoria", "Producto", "Cantidad", "Unidad", "Venta_Total", "Metodo_Pago", "Margen_Real_%"];
    const rows: any[] = [];

    engine.pRange.forEach(p => {
      p.detalle_pedido?.forEach((i: any) => {
        const ventaArticulo = i.quantity * (i.precio_venta || i['$ VENTA'] || 0);
        const margenArticulo = i.precio_venta > 0 ? ((i.precio_venta - i.costo) / i.precio_venta) * 100 : 0;
        
        rows.push([
          format(new Date(p.created_at), 'yyyy-MM-dd'),
          `"${i.categoria || 'Otros'}"`,
          `"${i.nombre}"`,
          i.quantity.toFixed(0),
          `"${i.unidad || 'kg'}"`,
          ventaArticulo.toFixed(0),
          `"${p.metodo_pago || 'Efectivo'}"`,
          margenArticulo.toFixed(0)
        ]);
      });
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AMOREE_IA_REPORT_${format(new Date(), 'ddMMyy')}.csv`;
    link.click();
  };

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse">SINCRO TITANIUM...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white font-sans selection:bg-green-500/30">
      
      {/* --- SELECTOR DE TIEMPO Y BOTÓN EXPORTAR --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5 shadow-2xl">
        <div className="flex bg-white/5 p-1.5 rounded-2xl gap-2 overflow-x-auto no-scrollbar">
          {['hoy', '7d', '30d', 'custom'].map(id => (
            <button key={id} onClick={() => setRango(id as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rango === id ? 'bg-white text-black shadow-xl' : 'text-gray-500'}`}>{id}</button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {rango === 'custom' && (
            <div className="flex items-center gap-3 animate-in fade-in zoom-in">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-green-500 outline-none" />
              <span className="text-gray-700">→</span>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-green-500 outline-none" />
            </div>
          )}
          {/* BOTÓN EXPORTAR TITANIUM */}
          <button 
            onClick={exportCSV}
            className="flex items-center gap-3 bg-white/5 border border-white/10 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 hover:text-white hover:border-green-500 transition-all group"
          >
            <span className="text-lg group-hover:scale-125 transition-transform">📥</span> Exportar para IA
          </button>
        </div>
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
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-3 px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black scale-105 shadow-xl' : 'bg-white/5 text-gray-500'}`}>
            <span className="text-lg">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <main className="animate-in fade-in duration-700">
        
        {/* (1) EJECUTIVO */}
        {activeTab === 1 && (
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Venta Total</p>
                <p className="text-4xl font-black tracking-tighter">{formatCurrencyZero(engine.vTotal)}</p>
                <div className={`mt-2 text-[10px] font-black ${engine.vsAnterior >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {engine.vsAnterior >= 0 ? '▲' : '▼'} {Math.abs(engine.vsAnterior)}% vs anterior
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Ticket Promedio</p>
                <p className="text-4xl font-black tracking-tighter">{formatCurrencyZero(engine.ticket)}</p>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3">Merma Periodo</p>
                <p className="text-4xl font-black text-red-500 tracking-tighter">{formatCurrencyZero(engine.mTotal)}</p>
              </div>
              <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-3">Margen Real</p>
                <p className="text-4xl font-black text-green-500 tracking-tighter">
                  {(engine.chartCategorias.reduce((a,b)=>a+b.margin,0) / (engine.chartCategorias.length || 1)).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter">🔥 Top 5 Productos</h3>
                  <div className="space-y-4">
                    {engine.top5.map(([name, qty]: any) => (
                      <div key={name} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <span className="text-xs font-bold text-gray-400 uppercase">{name}</span>
                        <span className="text-xs font-black text-white">{qty} kg/pza</span>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
                  <h3 className="text-xl font-black italic uppercase mb-8 tracking-tighter text-red-500">Agotados Críticos</h3>
                  <div className="space-y-4">
                    {productos.filter(p => p.stock_actual <= 0).slice(0, 4).map(p => (
                      <div key={p.sku} className="flex justify-between items-center p-4 bg-red-600/5 border border-red-600/20 rounded-2xl">
                        <span className="text-xs font-bold text-red-500 uppercase">{p.nombre}</span>
                        <span className="text-xs font-black text-white">AGOTADO</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* (2) VENTAS */}
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
                    <Legend wrapperStyle={{fontSize: '10px', color: '#fff', textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
                <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Método de Pago</h3>
                <ResponsiveContainer width="100%" height="90%">
                   <BarChart data={engine.chartPagos} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} fontStyle="bold" axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#111', color: '#fff', border: 'none', borderRadius: '15px'}} />
                      <Bar dataKey="value" fill="#22c55e" radius={[0, 10, 10, 0]} />
                   </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px]">
              <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest text-center">Intensidad por Horario</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={engine.chartHoras}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="hora" stroke="#666" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#111', border: 'none', borderRadius: '15px'}} />
                  <Bar dataKey="total" fill="#22c55e" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* (3) INVENTARIO */}
        {activeTab === 3 && (
          <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 overflow-x-auto">
            <h3 className="text-xl font-black italic uppercase mb-8">Rotación de Existencias</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-500 uppercase border-b border-white/5">
                  <th className="pb-6">Artículo</th>
                  <th className="pb-6">Stock Actual</th>
                  <th className="pb-6">Días Inventario</th>
                  <th className="pb-6">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {engine.invData.map(p => (
                  <tr key={p.sku} className="hover:bg-white/[0.02]">
                    <td className="py-6 font-bold text-xs uppercase">{p.nombre}</td>
                    <td className="py-6 font-black text-sm">{p.stock_actual} {p.unidad}</td>
                    <td className="py-6 font-black text-sm text-green-500">{p.diasInv} días</td>
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
        )}

        {/* (4) MERMA */}
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
                  const perdida = Math.round(parseFloat(cantMerma) * (p.costo || 0));
                  await supabase.from('merma').insert([{ 
                    producto_sku: p.sku, nombre_producto: p.nombre, cantidad: parseFloat(cantMerma), 
                    unidad: p.unidad, costo_unitario: p.costo, total_perdida: perdida, 
                    motivo: motivoMerma, categoria: p.categoria 
                  }]);
                  await supabase.from('productos').update({ stock_actual: (p.stock_actual || 0) - parseFloat(cantMerma) }).eq('sku', p.sku);
                  alert("Registrado ✅"); setCantMerma(''); setSkuMerma('');
                }} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl">🗑️ Registrar</button>
              </div>
            </div>
            <div className="lg:col-span-2 bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[500px] overflow-y-auto">
              <h3 className="text-sm font-black uppercase italic mb-8">Historial de Pérdidas</h3>
              {engine.mRange.map(m => (
                <div key={m.id} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl mb-3">
                  <div><p className="text-xs font-black uppercase">{m.nombre_producto}</p><p className="text-[9px] font-bold text-gray-500 uppercase">{format(new Date(m.created_at), 'dd MMM')} • {m.motivo}</p></div>
                  <p className="text-sm font-black text-red-500">-{formatCurrencyZero(m.total_perdida)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* (5) RENTABILIDAD */}
        {activeTab === 5 && (
          <div className="space-y-10">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-green-500">Margen Real vs Objetivo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {engine.chartCategorias.map(cat => (
                <div key={cat.name} className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 text-center transition-transform hover:scale-105">
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-widest">{cat.name}</p>
                  <p className="text-4xl font-black text-green-500 mb-2">{cat.margin.toFixed(0)}%</p>
                  <p className="text-[9px] font-bold text-gray-600 uppercase">Objetivo: {GOALS[cat.name] || 'N/A'}%</p>
                  <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${(cat.margin / (GOALS[cat.name] || 40)) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* (6) COMPRAS */}
        {activeTab === 6 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total Compras del Periodo</p>
              <p className="text-5xl font-black text-blue-500">{formatCurrencyZero(engine.comprasTotal)}</p>
              <p className="text-[9px] font-bold text-gray-600 mt-4 uppercase">Impacto sobre Ventas: {((engine.comprasTotal / (engine.vTotal || 1)) * 100).toFixed(0)}%</p>
            </div>
            <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[400px] overflow-y-auto">
              <h3 className="text-sm font-black uppercase italic mb-8 tracking-widest">Suministros Detallados</h3>
              {engine.cRange.slice(0, 10).map(c => (
                <div key={c.id} className="flex justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl mb-2">
                  <span className="text-[10px] font-black uppercase">{c.proveedor || 'General'}</span>
                  <span className="text-[10px] font-black">{formatCurrencyZero(c.total_compra)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* (7) ALERTAS */}
        {activeTab === 7 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {productos.filter(p => p.stock_actual <= 0).map(p => (
              <div key={p.sku} className="bg-red-600/10 border-2 border-red-600 p-8 rounded-[40px] text-center">
                <p className="text-[9px] font-black text-red-500 uppercase mb-2">AGOTADO TOTAL</p>
                <h4 className="text-xl font-black uppercase">{p.nombre}</h4>
                <p className="text-[9px] font-bold text-gray-400 mt-2">Llamar a proveedor urgente.</p>
              </div>
            ))}
            {engine.invData.filter(p => p.diasInv < 1 && p.stock_actual > 0).map(p => (
              <div key={p.sku} className="bg-amber-600/10 border-2 border-amber-600 p-8 rounded-[40px] text-center">
                <p className="text-[9px] font-black text-amber-500 uppercase mb-2">RESURTIDO CRÍTICO</p>
                <h4 className="text-xl font-black uppercase">{p.nombre}</h4>
                <p className="text-[10px] font-bold text-white mt-2">Días rest: {p.diasInv}</p>
              </div>
            ))}
            {engine.chartCategorias.filter(c => c.margin < (GOALS[c.name] || 0)).map(c => (
              <div key={c.name} className="bg-blue-600/10 border-2 border-blue-600 p-8 rounded-[40px] text-center">
                <p className="text-[9px] font-black text-blue-500 uppercase mb-2">BAJO MARGEN</p>
                <h4 className="text-xl font-black uppercase">{c.name}</h4>
                <p className="text-[10px] font-bold text-white mt-2">Margen Real: {c.margin}%</p>
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
               <p className="text-[12px] font-black text-white uppercase tracking-tighter mb-1 leading-none">Amoree Business OS</p>
               <p className="text-[9px] font-bold text-green-500/40 uppercase tracking-[0.4em]">Engineering Partner</p>
            </div>
         </div>
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
