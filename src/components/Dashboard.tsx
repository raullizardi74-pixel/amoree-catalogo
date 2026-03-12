import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  startOfDay, endOfDay, subDays, isWithinInterval, format, parseISO
} from 'date-fns';
import { 
  TrendingDown, TrendingUp, ChevronDown, 
  Zap, Brain, Target, Package, ShoppingCart, Save, Calendar as CalendarIcon, X, Check
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
  
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [expandedCompraCat, setExpandedCompraCat] = useState<string | null>(null);

  // --- ESTADO DE IA CON SINCRONIZACIÓN ---
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
        supabase.from('app_settings').select('content').eq('id', 'directivas_ia').single()
      ]);
      if (pRes.data) setPedidos(pRes.data);
      if (prRes.data) setProductos(prRes.data);
      if (mRes.data) setMermas(mRes.data);
      if (cRes.data) setCompras(cRes.data);
      if (settRes.data) setNotasIA(settRes.data.content);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // --- FUNCIÓN PARA GUARDAR EN LA NUBE ---
  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ content: notasIA, updated_at: new Date() })
        .eq('id', 'directivas_ia');
      
      if (!error) {
        setHasChanges(false);
        // Feedback visual de éxito
      }
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const engine = useMemo(() => {
    const ahora = new Date();
    let inicio: Date, fin: Date;

    if (rango === 'hoy') { inicio = startOfDay(ahora); fin = endOfDay(ahora); }
    else if (rango === '7d') { inicio = startOfDay(subDays(ahora, 7)); fin = endOfDay(ahora); }
    else if (rango === '30d') { inicio = startOfDay(subDays(ahora, 30)); fin = endOfDay(ahora); }
    else { 
      // Arreglo del Calendario Custom: Asegurar que parsee correctamente los inputs
      inicio = startOfDay(parseISO(fechaInicio)); 
      fin = endOfDay(parseISO(fechaFin)); 
    }

    const pRange = pedidos.filter(p => isWithinInterval(new Date(p.created_at), { start: inicio, end: fin }));
    const cRange = compras.filter(c => isWithinInterval(new Date(c.created_at), { start: inicio, end: fin }));
    const vTotal = pRange.reduce((acc, b) => acc + b.total, 0);
    const comprasTotal = cRange.reduce((acc, b) => acc + (b.total_compra || 0), 0);

    // Comparativa de Costos
    const comprasDetalle = cRange.map(compra => {
      const historial = compras.filter(c => c.producto_sku === compra.producto_sku && new Date(c.created_at) < new Date(compra.created_at)).slice(0, 6);
      const precioAnterior = historial[0]?.costo_unitario || compra.costo_unitario;
      const promedio6 = historial.length > 0 ? historial.reduce((acc, curr) => acc + curr.costo_unitario, 0) / historial.length : compra.costo_unitario;
      return { ...compra, diffAnterior: ((compra.costo_unitario - precioAnterior) / precioAnterior) * 100, diffPromedio: ((compra.costo_unitario - promedio6) / promedio6) * 100 };
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
      comprasPorCat, pRange, invValor: productos.reduce((acc, p) => acc + (p.stock_actual * (p.costo || 0)), 0),
      ticket: vTotal / (pRange.length || 1),
      chartCategorias: Object.entries(GOALS).map(([name]) => {
        const catP = pRange.flatMap(p => p.detalle_pedido || []).filter((i:any) => i.categoria === name);
        const venta = catP.reduce((acc, i) => acc + (i.quantity * i.precio_venta), 0);
        const costo = catP.reduce((acc, i) => acc + (i.quantity * i.costo), 0);
        return { name, value: Math.round(venta), margin: venta > 0 ? ((venta - costo) / venta) * 100 : 0 };
      })
    };
  }, [rango, fechaInicio, fechaFin, pedidos, productos, compras]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-black animate-pulse tracking-[0.3em]">Cargando Dashboard...</div>;

  return (
    <div className="bg-[#050505] min-h-screen p-4 md:p-10 text-white selection:bg-green-500/30">
      
      {/* HEADER + CALENDARIO FIXED */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-[#0A0A0A] p-6 rounded-[35px] border border-white/5">
        <div>
           <h1 className="text-xl font-black uppercase italic tracking-tighter text-white">Amoree <span className="text-green-500">Business OS</span></h1>
           <p className="text-[7px] font-bold text-gray-600 uppercase tracking-[0.4em]">Panel de Control Titanium</p>
        </div>
        
        {/* SELECTOR DE RANGO MEJORADO */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-white/5 p-1 rounded-2xl gap-1">
            {['hoy', '7d', '30d', 'custom'].map(id => (
              <button key={id} onClick={() => setRango(id as any)} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${rango === id ? 'bg-white text-black shadow-lg' : 'text-gray-500'}`}>{id}</button>
            ))}
          </div>

          {rango === 'custom' && (
            <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 animate-in slide-in-from-right duration-300">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-transparent text-[10px] font-black text-green-500 outline-none" />
              <span className="text-gray-700">→</span>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="bg-transparent text-[10px] font-black text-green-500 outline-none" />
            </div>
          )}
        </div>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="flex overflow-x-auto gap-2 pb-6 mb-8 no-scrollbar sticky top-0 bg-[#050505] z-50">
        {[
          { id: 1, label: 'Ejecutivo', icon: <Target size={14}/> },
          { id: 6, label: 'Compras', icon: <ShoppingCart size={14}/> },
          { id: 5, label: 'Rentabilidad', icon: <TrendingUp size={14}/> },
          { id: 3, label: 'Inventario', icon: <Package size={14}/> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-6 py-4 rounded-[22px] text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black shadow-xl' : 'bg-white/5 text-gray-500'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <main className="animate-in fade-in duration-700">
        
        {/* PESTAÑA EJECUTIVO + PORTAL DE IA (SINCRONIZADO) */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Venta Periodo</p>
                  <p className="text-4xl font-black">{formatCurrencyZero(engine.vTotal)}</p>
                </div>
                <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-2">Inversión Compra</p>
                  <p className="text-4xl font-black text-blue-500">{formatCurrencyZero(engine.comprasTotal)}</p>
                </div>
                <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                  <p className="text-[9px] font-black text-green-500 uppercase mb-2">Ticket Promedio</p>
                  <p className="text-4xl font-black text-green-500">{formatCurrencyZero(engine.ticket)}</p>
                </div>
              </div>

              <div className="bg-[#0A0A0A] p-10 rounded-[50px] border border-white/5 h-[380px]">
                 <h3 className="text-[10px] font-black uppercase mb-8 text-gray-500 tracking-widest">Distribución de Ventas por Categoría</h3>
                 <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={engine.chartCategorias}>
                       <XAxis dataKey="name" stroke="#333" fontSize={10} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '20px'}} />
                       <Bar dataKey="value" fill="#22c55e" radius={[15, 15, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            </div>

            {/* PORTAL DE IA CON BOTÓN DE GUARDAR PERSISTENTE */}
            <div className="bg-[#0A0A0A] p-8 rounded-[45px] border border-green-500/20 shadow-2xl relative">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Brain size={20}/></div>
                    <div>
                      <h3 className="text-sm font-black uppercase italic tracking-tighter">Directivas IA</h3>
                      <p className="text-[7px] text-gray-600 font-bold uppercase">Sincronización Cloud</p>
                    </div>
                  </div>
                  {/* BOTÓN DE GUARDAR DINÁMICO */}
                  <button 
                    onClick={handleSaveNotes}
                    disabled={!hasChanges || isSaving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${hasChanges ? 'bg-green-600 text-black animate-pulse shadow-lg shadow-green-500/20' : 'bg-white/5 text-gray-500 opacity-50'}`}
                  >
                    {isSaving ? 'Sincronizando...' : hasChanges ? <><Save size={12}/> Guardar</> : <><Check size={12}/> Al día</>}
                  </button>
               </div>
               
               <textarea 
                  value={notasIA}
                  onChange={(e) => {
                    setNotasIA(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="PEGA AQUÍ LAS DIRECTIVAS DE NOTEBOOKLM..."
                  className="w-full h-[450px] bg-black/40 border border-white/5 rounded-[30px] p-6 text-[11px] font-medium leading-relaxed text-gray-300 outline-none focus:border-green-500/30 transition-all placeholder:text-gray-800"
               />
               <p className="mt-4 text-[7px] text-center font-bold text-gray-600 uppercase tracking-widest italic">Los cambios guardados se reflejan al instante en todos los dispositivos</p>
            </div>
          </div>
        )}

        {/* PESTAÑA COMPRAS TITANIUM */}
        {activeTab === 6 && (
          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/20 p-8 rounded-[40px] flex justify-between items-center shadow-lg">
               <div>
                  <p className="text-[9px] font-black text-blue-500 uppercase mb-1">Inversión Analizada</p>
                  <p className="text-4xl font-black">{formatCurrencyZero(engine.comprasTotal)}</p>
               </div>
               <div className="p-4 bg-white/5 rounded-3xl text-right">
                  <p className="text-[9px] font-black text-gray-500 uppercase">Items Surtidos</p>
                  <p className="text-2xl font-black text-white leading-none mt-1">{engine.cRange.length}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(engine.comprasPorCat).map(([cat, items]: any) => (
                <div key={cat} className="rounded-[35px] border border-white/5 bg-[#0A0A0A] overflow-hidden transition-all hover:border-white/10">
                  <button 
                    onClick={() => setExpandedCompraCat(expandedCompraCat === cat ? null : cat)}
                    className="w-full p-6 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                       <h3 className="text-[10px] font-black uppercase tracking-widest">{cat}</h3>
                    </div>
                    <ChevronDown size={16} className={`text-gray-600 transition-transform ${expandedCompraCat === cat ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedCompraCat === cat && (
                    <div className="px-6 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2">
                      {items.map((c: any) => (
                        <div key={c.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex justify-between items-center">
                           <div className="w-1/2">
                              <p className="text-[10px] font-black uppercase text-white truncate">{c.nombre_producto}</p>
                              <p className="text-[8px] font-bold text-gray-600 uppercase mt-0.5">{c.cantidad} {c.unidad} @ {formatCurrency(c.costo_unitario)}</p>
                           </div>
                           <div className="flex gap-4 items-center">
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-gray-600 uppercase mb-1">vs Anterior</p>
                                 <div className={`flex items-center gap-1 text-[10px] font-black ${c.diffAnterior <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {c.diffAnterior <= 0 ? <TrendingDown size={12}/> : <TrendingUp size={12}/>}
                                    {Math.abs(c.diffAnterior).toFixed(1)}%
                                 </div>
                              </div>
                              <div className="w-[1px] h-8 bg-white/5"></div>
                              <div className="text-right">
                                 <p className="text-[8px] font-black text-gray-600 uppercase mb-1">Subtotal</p>
                                 <p className="text-[11px] font-black text-white">{formatCurrencyZero(c.total_compra)}</p>
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

      </main>

      {/* FOOTER SYNC */}
      <div className="fixed bottom-6 right-6 hidden md:block">
         <div className="bg-black/90 backdrop-blur-3xl border border-white/10 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400">Cloud Sync Active</p>
         </div>
      </div>
    </div>
  );
}
