import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, format, parseISO, isValid
} from 'date-fns';
import { 
  TrendingDown, TrendingUp, ChevronDown, 
  Zap, Brain, Target, Package, ShoppingCart, Save, X, Check, AlertCircle, RefreshCw
} from 'lucide-react';

// Formateador seguro
const formatCurrencyZero = (value: number) => {
  if (isNaN(value) || value === null || value === undefined) return "$0";
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
  
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [expandedCompraCat, setExpandedCompraCat] = useState<string | null>(null);

  const [notasIA, setNotasIA] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const GOALS: any = { 'Verduras': 35, 'Frutas': 35, 'Cremería': 25, 'Abarrotes': 15 };
  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [pRes, prRes, mRes, cRes, settRes] = await Promise.all([
        supabase.from('pedidos').select('*').in('estado', ['Finalizado', 'Pagado', 'Pagado - Por Entregar']),
        supabase.from('productos').select('*').order('nombre'),
        supabase.from('merma').select('*').order('created_at', { ascending: false }),
        supabase.from('compras').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('content').eq('id', 'directivas_ia').maybeSingle()
      ]);
      
      setPedidos(pRes.data || []);
      setProductos(prRes.data || []);
      setMermas(mRes.data || []);
      setCompras(cRes.data || []);
      if (settRes.data) setNotasIA(settRes.data.content);
    } catch (e) { console.error("Error en carga:", e); }
    finally { setLoading(false); }
  }

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await supabase.from('app_settings').upsert({ id: 'directivas_ia', content: notasIA, updated_at: new Date() });
      setHasChanges(false);
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const engine = useMemo(() => {
    const ahora = new Date();
    let inicio: Date = startOfDay(ahora);
    let fin: Date = endOfDay(ahora);

    try {
      if (rango === '7d') inicio = startOfDay(subDays(ahora, 7));
      else if (rango === '30d') inicio = startOfDay(subDays(ahora, 30));
      else if (rango === 'custom') {
        const i = parseISO(fechaInicio);
        const f = parseISO(fechaFin);
        if (isValid(i) && isValid(f)) { inicio = startOfDay(i); fin = endOfDay(f); }
      }
    } catch (e) { console.error("Error en fechas", e); }

    const pRange = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: inicio, end: fin }));
    const cRange = compras.filter(c => isWithinInterval(new Date(c.created_at), { start: inicio, end: fin }));
    
    const vTotal = pRange.reduce((acc, b) => acc + (b.total || 0), 0);
    const comprasTotal = cRange.reduce((acc, b) => acc + (b.total_compra || 0), 0);

    const comprasDetalle = cRange.map(compra => {
      const historial = compras.filter(c => c.producto_sku === compra.producto_sku && new Date(c.created_at) < new Date(compra.created_at)).slice(0, 6);
      const precioAnterior = historial[0]?.costo_unitario || compra.costo_unitario || 0;
      const promedio6 = historial.length > 0 ? historial.reduce((acc, curr) => acc + (curr.costo_unitario || 0), 0) / historial.length : (compra.costo_unitario || 0);
      
      return { 
        ...compra, 
        diffAnterior: precioAnterior > 0 ? ((compra.costo_unitario - precioAnterior) / precioAnterior) * 100 : 0,
        diffPromedio: promedio6 > 0 ? ((compra.costo_unitario - promedio6) / promedio6) * 100 : 0 
      };
    });

    const comprasPorCat: any = {};
    comprasDetalle.forEach(c => {
      const prod = productos.find(p => p.sku === c.producto_sku);
      const cat = prod?.categoria || 'Otros';
      if (!comprasPorCat[cat]) comprasPorCat[cat] = [];
      comprasPorCat[cat].push(c);
    });

    return {
      vTotal, comprasTotal, count: pRange.length,
      comprasPorCat, cRange: comprasDetalle, 
      invValor: productos.reduce((acc, p) => acc + ((p.stock_actual || 0) * (p.costo || 0)), 0),
      ticket: vTotal / (pRange.length || 1),
      chartCategorias: Object.entries(GOALS).map(([name]) => {
        const catP = pRange.flatMap(p => p.detalle_pedido || []).filter((i:any) => i.categoria === name);
        const venta = catP.reduce((acc, i) => acc + (i.quantity * (i.precio_venta || 0)), 0);
        const costo = catP.reduce((acc, i) => acc + (i.quantity * (i.costo || 0)), 0);
        return { name, value: Math.round(venta), margin: venta > 0 ? ((venta - costo) / venta) * 100 : 0 };
      })
    };
  }, [rango, fechaInicio, fechaFin, pedidos, productos, compras]);

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <RefreshCw className="text-green-500 animate-spin" size={32} />
      <p className="text-green-500 font-black tracking-widest uppercase text-xs">Sincronizando Business OS...</p>
    </div>
  );

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white font-sans overflow-x-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5">
        <div>
           <h1 className="text-xl font-black uppercase italic tracking-tighter">Amoree <span className="text-green-500">Business OS</span></h1>
           <p className="text-[7px] font-bold text-gray-600 uppercase tracking-[0.4em]">Auditado por Raúl</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
            {['hoy', '7d', '30d', 'custom'].map(id => (
              <button key={id} onClick={() => setRango(id as any)} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${rango === id ? 'bg-white text-black' : 'text-gray-500'}`}>{id}</button>
            ))}
          </div>

          {rango === 'custom' && (
            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 animate-in slide-in-from-right">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-transparent text-[10px] font-black text-green-500 outline-none" />
              <span className="text-gray-700">→</span>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="bg-transparent text-[10px] font-black text-green-500 outline-none" />
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex overflow-x-auto gap-2 pb-6 mb-8 no-scrollbar sticky top-0 bg-[#050505] z-50">
        {[
          { id: 1, label: 'Ejecutivo', icon: <Target size={14}/> },
          { id: 6, label: 'Compras', icon: <ShoppingCart size={14}/> },
          { id: 5, label: 'Rentabilidad', icon: <TrendingUp size={14}/> },
          { id: 3, label: 'Inventario', icon: <Package size={14}/> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 rounded-[22px] text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black shadow-xl scale-105' : 'bg-white/5 text-gray-500'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <main>
        {/* PESTAÑA 1: EJECUTIVO */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 shadow-lg">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Venta Periodo</p>
                  <p className="text-3xl font-black">{formatCurrencyZero(engine?.vTotal)}</p>
                </div>
                <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 shadow-lg">
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-2">Inversión Compra</p>
                  <p className="text-3xl font-black text-blue-500">{formatCurrencyZero(engine?.comprasTotal)}</p>
                </div>
                <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 shadow-lg">
                  <p className="text-[9px] font-black text-green-500 uppercase mb-2">Ticket Promedio</p>
                  <p className="text-3xl font-black text-green-500">{formatCurrencyZero(engine?.ticket)}</p>
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[380px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={engine?.chartCategorias || []}>
                       <XAxis dataKey="name" stroke="#333" fontSize={10} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '20px'}} />
                       <Bar dataKey="value" fill="#22c55e" radius={[15, 15, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-[#0A0A0A] p-8 rounded-[45px] border border-green-500/20 shadow-2xl">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Brain size={20}/></div>
                    <h3 className="text-sm font-black uppercase italic tracking-tighter">Directivas IA</h3>
                  </div>
                  <button onClick={handleSaveNotes} disabled={!hasChanges || isSaving} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${hasChanges ? 'bg-green-600 text-black shadow-lg shadow-green-500/20' : 'bg-white/5 text-gray-500 opacity-50'}`}>
                    {isSaving ? '...' : hasChanges ? <><Save size={12}/> Guardar</> : <><Check size={12}/> Al día</>}
                  </button>
               </div>
               <textarea value={notasIA} onChange={(e) => { setNotasIA(e.target.value); setHasChanges(true); }} placeholder="PEGA LAS DIRECTIVAS DE RAÚL..." className="w-full h-[450px] bg-black/40 border border-white/5 rounded-[30px] p-6 text-[11px] font-medium leading-relaxed text-gray-300 outline-none focus:border-green-500/30 transition-all placeholder:text-gray-800" />
            </div>
          </div>
        )}

        {/* PESTAÑA 6: COMPRAS (BLINDADA) */}
        {activeTab === 6 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-blue-600/10 border border-blue-500/20 p-8 rounded-[40px] flex justify-between items-center shadow-lg">
               <div>
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-1">Inversión Analizada</p>
                  <p className="text-4xl font-black">{formatCurrencyZero(engine?.comprasTotal)}</p>
               </div>
               <p className="text-2xl font-black text-white">{engine?.cRange?.length || 0} ITEMS</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(engine?.comprasPorCat || {}).map(([cat, items]: any) => (
                <div key={cat} className="rounded-[35px] border border-white/5 bg-[#0A0A0A] overflow-hidden">
                  <button onClick={() => setExpandedCompraCat(expandedCompraCat === cat ? null : cat)} className="w-full p-6 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest">{cat}</h3>
                    <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCompraCat === cat ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedCompraCat === cat && (
                    <div className="px-6 pb-6 space-y-3">
                      {(items || []).map((c: any) => (
                        <div key={c.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex justify-between items-center">
                           <div className="w-1/2">
                              <p className="text-[10px] font-black uppercase text-white truncate">{c.nombre_producto || 'Sin nombre'}</p>
                              <p className="text-[8px] font-bold text-gray-600 uppercase mt-0.5">{c.cantidad || 0} {c.unidad || ''} @ {formatCurrency(c.costo_unitario || 0)}</p>
                           </div>
                           <div className="flex gap-4 items-center">
                              <div className={`flex items-center gap-1 text-[10px] font-black ${ (c.diffAnterior || 0) <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                 { (c.diffAnterior || 0) <= 0 ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                                 {Math.abs(c.diffAnterior || 0).toFixed(1)}%
                              </div>
                              <p className="text-[11px] font-black text-white">{formatCurrencyZero(c.total_compra || 0)}</p>
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

        {/* PESTAÑA 5: RENTABILIDAD */}
        {activeTab === 5 && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
              {(engine?.chartCategorias || []).map(cat => (
                <div key={cat.name} className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 shadow-lg">
                   <p className="text-[9px] font-black text-gray-500 uppercase mb-4 tracking-widest">{cat.name}</p>
                   <p className={`text-4xl font-black mb-2 ${cat.margin < (GOALS[cat.name] || 0) ? 'text-red-500' : 'text-green-500'}`}>
                      {(cat.margin || 0).toFixed(0)}%
                   </p>
                   <p className="text-[8px] font-bold text-gray-700 uppercase italic">Objetivo: {GOALS[cat.name] || 'N/A'}%</p>
                </div>
              ))}
           </div>
        )}

        {/* PESTAÑA 3: INVENTARIO */}
        {activeTab === 3 && (
           <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-[#0A0A0A] p-10 rounded-[45px] border border-white/5 flex justify-between items-center shadow-2xl">
                 <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Valor de Mercancía en Estante</p>
                    <p className="text-5xl font-black text-amber-500">{formatCurrencyZero(engine?.invValor)}</p>
                 </div>
                 <Package size={48} className="text-white/5" />
              </div>
           </div>
        )}
      </main>
    </div>
  );
}
