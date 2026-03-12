import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, format, parseISO, differenceInDays
} from 'date-fns';
import { 
  TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, 
  Zap, Brain, Target, Package, ShoppingCart, AlertCircle, Save
} from 'lucide-react';

const formatCurrencyZero = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(value));
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState<'hoy' | '7d' | '30d' | 'custom'>('hoy');
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fechaFin, setFechaFin] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Estados de Datos
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [expandedCompraCat, setExpandedCompraCat] = useState<string | null>(null);

  // Portal de IA (Persistencia en LocalStorage para no perder notas al refrescar)
  const [notasIA, setNotasIA] = useState(() => localStorage.getItem('amoree_ia_notes') || '');

  const GOALS: any = { 'Verduras': 35, 'Frutas': 35, 'Cremería': 25, 'Abarrotes': 15 };
  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('amoree_ia_notes', notasIA);
  }, [notasIA]);

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

  const engine = useMemo(() => {
    const ahora = new Date();
    let inicio: Date, fin: Date;

    if (rango === 'hoy') { inicio = startOfDay(ahora); fin = endOfDay(ahora); }
    else if (rango === '7d') { inicio = startOfDay(subDays(ahora, 7)); fin = endOfDay(ahora); }
    else if (rango === '30d') { inicio = startOfDay(subDays(ahora, 30)); fin = endOfDay(ahora); }
    else { inicio = startOfDay(parseISO(fechaInicio)); fin = endOfDay(parseISO(fechaFin)); }

    const pRange = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: inicio, end: fin }));
    const cRange = compras.filter(c => isWithinInterval(new Date(c.created_at), { start: inicio, end: fin }));
    const mRange = mermas.filter(m => isWithinInterval(new Date(m.created_at), { start: inicio, end: fin }));

    const vTotal = pRange.reduce((a, b) => a + b.total, 0);
    const comprasTotal = cRange.reduce((a, b) => a + (b.total_compra || 0), 0);

    // --- ANÁLISIS DE COMPRAS TITANIUM (Comparativa de Costos) ---
    const comprasDetalle = cRange.map(compra => {
      const historial = compras.filter(c => c.producto_sku === compra.producto_sku && new Date(c.created_at) < new Date(compra.created_at)).slice(0, 6);
      const precioAnterior = historial[0]?.costo_unitario || compra.costo_unitario;
      const promedio6 = historial.length > 0 ? historial.reduce((acc, curr) => acc + curr.costo_unitario, 0) / historial.length : compra.costo_unitario;
      
      return {
        ...compra,
        diffAnterior: ((compra.costo_unitario - precioAnterior) / precioAnterior) * 100,
        diffPromedio: ((compra.costo_unitario - promedio6) / promedio6) * 100
      };
    });

    // Agrupación de compras por categoría para tarjetas expandibles
    const comprasPorCat: any = {};
    comprasDetalle.forEach(c => {
      const prod = productos.find(p => p.sku === c.producto_sku);
      const cat = prod?.categoria || 'Otros';
      if (!comprasPorCat[cat]) comprasPorCat[cat] = [];
      comprasPorCat[cat].push(c);
    });

    return {
      vTotal, comprasTotal, count: pRange.length,
      comprasPorCat, pRange, mRange, cRange: comprasDetalle,
      ticket: vTotal / (pRange.length || 1),
      invValor: productos.reduce((acc, p) => acc + (p.stock_actual * (p.costo || 0)), 0),
      chartCategorias: Object.entries(GOALS).map(([name]) => {
        const catP = pRange.flatMap(p => p.detalle_pedido || []).filter((i:any) => i.categoria === name);
        const venta = catP.reduce((acc, i) => acc + (i.quantity * i.precio_venta), 0);
        const costo = catP.reduce((acc, i) => acc + (i.quantity * i.costo), 0);
        return { name, value: Math.round(venta), margin: venta > 0 ? ((venta - costo) / venta) * 100 : 0 };
      })
    };
  }, [rango, fechaInicio, fechaFin, pedidos, productos, mermas, compras]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse uppercase tracking-[0.3em]">Sincronizando Business OS...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white font-sans">
      
      {/* HEADER ESTRATÉGICO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5">
        <div>
           <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business Dashboard</span></h1>
           <p className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.3em]">Socio Tecnológico: Automatiza con Raúl</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl gap-2">
          {['hoy', '7d', '30d', 'custom'].map(id => (
            <button key={id} onClick={() => setRango(id as any)} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${rango === id ? 'bg-white text-black' : 'text-gray-500'}`}>{id}</button>
          ))}
        </div>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="flex overflow-x-auto gap-3 pb-6 mb-10 no-scrollbar sticky top-0 bg-[#050505] z-50">
        {[
          { id: 1, label: 'Ejecutivo', icon: <Target size={16}/> },
          { id: 6, label: 'Compras', icon: <ShoppingCart size={16}/> },
          { id: 5, label: 'Rentabilidad', icon: <TrendingUp size={16}/> },
          { id: 3, label: 'Inventario', icon: <Package size={16}/> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black' : 'bg-white/5 text-gray-500'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <main className="animate-in fade-in duration-500">
        
        {/* (1) EJECUTIVO + PORTAL IA */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0A0A0A] p-8 rounded-[35px] border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Venta Periodo</p>
                  <p className="text-3xl font-black">{formatCurrencyZero(engine.vTotal)}</p>
                </div>
                <div className="bg-[#0A0A0A] p-8 rounded-[35px] border border-white/5">
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-2">Inversión Compra</p>
                  <p className="text-3xl font-black text-blue-500">{formatCurrencyZero(engine.comprasTotal)}</p>
                </div>
                <div className="bg-[#0A0A0A] p-8 rounded-[35px] border border-white/5">
                  <p className="text-[9px] font-black text-green-500 uppercase mb-2">Ticket Promedio</p>
                  <p className="text-3xl font-black text-green-500">{formatCurrencyZero(engine.ticket)}</p>
                </div>
              </div>

              {/* GRÁFICO VENTAS */}
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 h-[350px]">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-gray-400 tracking-widest">Flujo de Caja (Ventas)</h3>
                 <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={engine.chartCategorias}>
                       <XAxis dataKey="name" stroke="#444" fontSize={10} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '15px'}} />
                       <Bar dataKey="value" fill="#22c55e" radius={[10, 10, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>

            {/* PORTAL DE IA - DIRECTIVAS DE RAÚL */}
            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.05)]">
               <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Brain size={20}/></div>
                  <div>
                    <h3 className="text-sm font-black uppercase italic tracking-tighter">Directivas IA</h3>
                    <p className="text-[7px] text-gray-500 font-bold uppercase">Análisis de Raúl (NotebookLM)</p>
                  </div>
               </div>
               <textarea 
                  value={notasIA}
                  onChange={(e) => setNotasIA(e.target.value)}
                  placeholder="PEGA AQUÍ EL ANÁLISIS DE NOTEBOOKLM PARA QUE HUGO LO VEA..."
                  className="w-full h-[400px] bg-black/50 border border-white/5 rounded-2xl p-4 text-[11px] font-medium leading-relaxed text-gray-300 outline-none focus:border-green-500/30 transition-all placeholder:text-gray-700"
               />
               <p className="mt-4 text-[8px] text-center font-bold text-gray-600 uppercase italic">Los cambios se guardan automáticamente para Hugo</p>
            </div>
          </div>
        )}

        {/* (6) COMPRAS TITANIUM - TARJETAS EXPANDIBLES */}
        {activeTab === 6 && (
          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/20 p-8 rounded-[40px] flex justify-between items-center">
               <div>
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-1">Inversión Total del Día</p>
                  <p className="text-4xl font-black">{formatCurrencyZero(engine.comprasTotal)}</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-gray-500 uppercase">Items Surtidos</p>
                  <p className="text-2xl font-black text-white">{engine.cRange.length}</p>
               </div>
            </div>

            <div className="space-y-4">
              {Object.entries(engine.comprasPorCat).map(([cat, items]: any) => (
                <div key={cat} className="rounded-[30px] border border-white/5 bg-[#0A0A0A] overflow-hidden">
                  <button 
                    onClick={() => setExpandedCompraCat(expandedCompraCat === cat ? null : cat)}
                    className="w-full p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                       <h3 className="text-[10px] font-black uppercase tracking-widest">{cat}</h3>
                    </div>
                    <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCompraCat === cat ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedCompraCat === cat && (
                    <div className="px-6 pb-6 space-y-3">
                      {items.map((c: any) => (
                        <div key={c.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex justify-between items-center">
                           <div className="w-1/2">
                              <p className="text-[10px] font-black uppercase">{c.nombre_producto}</p>
                              <p className="text-[7px] font-bold text-gray-600 uppercase">{c.cantidad} {c.unidad} @ {formatCurrency(c.costo_unitario)}</p>
                           </div>
                           <div className="flex gap-4 items-center">
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-gray-500 uppercase mb-1">vs Anterior</p>
                                 <div className={`flex items-center gap-1 text-[10px] font-black ${c.diffAnterior <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {c.diffAnterior <= 0 ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                                    {Math.abs(c.diffAnterior).toFixed(1)}%
                                 </div>
                              </div>
                              <div className="w-[1px] h-8 bg-white/5"></div>
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Total</p>
                                 <p className="text-[11px] font-black">{formatCurrencyZero(c.total_compra)}</p>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* (5) RENTABILIDAD */}
        {activeTab === 5 && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {engine.chartCategorias.map(cat => (
                <div key={cat.name} className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                   <p className="text-[9px] font-black text-gray-500 uppercase mb-4 tracking-widest">{cat.name}</p>
                   <p className={`text-4xl font-black mb-2 ${cat.margin < (GOALS[cat.name] || 0) ? 'text-red-500' : 'text-green-500'}`}>
                      {cat.margin.toFixed(0)}%
                   </p>
                   <p className="text-[8px] font-bold text-gray-700 uppercase">Objetivo: {GOALS[cat.name]}%</p>
                </div>
              ))}
           </div>
        )}

        {/* (3) INVENTARIO */}
        {activeTab === 3 && (
           <div className="space-y-8">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Valor Total del Inventario</p>
                    <p className="text-5xl font-black text-amber-500">{formatCurrencyZero(engine.invValor)}</p>
                 </div>
                 <Package size={48} className="text-white/5" />
              </div>
           </div>
        )}

      </main>

      {/* FOOTER SWISS MADE */}
      <div className="fixed bottom-6 right-6 hidden md:block">
         <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-3xl flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-[9px] font-black uppercase tracking-widest">Sincronizado con Supabase Realtime</p>
         </div>
      </div>
    </div>
  );
}
