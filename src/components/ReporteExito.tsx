import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  TrendingUp, TrendingDown, DollarSign, Trash2, 
  ArrowLeft, Calendar, AlertCircle, ShoppingBag, 
  PieChart, ArrowRight, Zap
} from 'lucide-react';

export default function ReporteExito({ onBack }: { onBack: () => void }) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // ✅ CALCULAR MARCO DE 24 HORAS EXACTAS
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Traer Pedidos Finalizados
      const { data: dataPedidos } = await supabase
        .from('pedidos')
        .select('*')
        .eq('estado', 'Finalizado')
        .gte('created_at', hace24Horas);

      // 2. Traer Mermas del periodo
      const { data: dataMermas } = await supabase
        .from('merma')
        .select('*')
        .gte('created_at', hace24Horas);

      // 3. Traer Productos (para obtener costos actuales y calcular utilidad)
      const { data: dataProds } = await supabase.from('productos').select('id, sku, costo');

      if (dataPedidos) setPedidos(dataPedidos);
      if (dataMermas) setMermas(dataMermas);
      if (dataProds) setProductos(dataProds);

    } catch (e) {
      console.error("Error en Auditoría:", e);
    } finally {
      setLoading(false);
    }
  };

  // 🧠 CEREBRO DE MÉTRICAS TITANIUM
  const stats = useMemo(() => {
    const ventasTotales = pedidos.reduce((acc, p) => acc + (p.total || 0), 0);
    const perdidaPorMerma = mermas.reduce((acc, m) => acc + (m.total_perdida || 0), 0);
    
    // Calcular Costo de lo Vendido (COGS)
    let costoTotalVendido = 0;
    pedidos.forEach(p => {
      const detalles = Array.isArray(p.detalle_pedido) ? p.detalle_pedido : [];
      detalles.forEach((item: any) => {
        const prod = productos.find(x => x.id === item.id || x.sku === item.sku);
        const costoUnitario = prod?.costo || 0;
        costoTotalVendido += (costoUnitario * (item.quantity || 0));
      });
    });

    const utilidadBruta = ventasTotales - costoTotalVendido;
    const utilidadNeta = utilidadBruta - perdidaPorMerma;
    const margenReal = ventasTotales > 0 ? (utilidadNeta / ventasTotales) * 100 : 0;

    // Top 5 Productos más mermados
    const topMermas = [...mermas]
      .sort((a, b) => b.total_perdida - a.total_perdida)
      .slice(0, 5);

    return {
      ventasTotales,
      perdidaPorMerma,
      costoTotalVendido,
      utilidadNeta,
      margenReal,
      topMermas,
      conteoPedidos: pedidos.length
    };
  }, [pedidos, mermas, productos]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Zap className="text-green-500 animate-pulse mx-auto mb-4" size={48} />
        <p className="text-green-500 font-black uppercase tracking-[0.3em] text-xs">Calculando Éxito Real...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 lg:p-10 animate-in fade-in duration-700">
      {/* HEADER ESTRATÉGICO */}
      <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">
              Auditoría de <span className="text-green-500">Éxito</span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Calendar size={14} className="text-gray-500" />
              <p className="text-[10px] text-gray-500 font-black tracking-widest uppercase">Últimas 24 Horas de Operación</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-600/10 border border-green-500/20 p-4 rounded-3xl flex items-center gap-4">
           <div className="text-right">
             <p className="text-[8px] font-black text-gray-500 uppercase">Estatus de Caja</p>
             <p className="text-sm font-black text-green-500 uppercase">Sincronizado</p>
           </div>
           <PieChart className="text-green-500" size={24} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {/* CARD: VENTAS */}
        <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <ShoppingBag size={64} />
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Ingresos Totales</p>
          <h3 className="text-3xl font-black">{formatCurrency(stats.ventasTotales)}</h3>
          <p className="text-[9px] text-green-500 font-bold mt-2 uppercase">{stats.conteoPedidos} Transacciones</p>
        </div>

        {/* CARD: COSTO OPERATIVO */}
        <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px]">
          <p className="text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Inversión Vendida</p>
          <h3 className="text-3xl font-black text-gray-300">{formatCurrency(stats.costoTotalVendido)}</h3>
          <p className="text-[9px] text-gray-600 font-bold mt-2 uppercase">Costo Base de Mercancía</p>
        </div>

        {/* CARD: FUGA POR MERMA (IMPACTO ROJO) */}
        <div className="bg-[#0A0A0A] border border-red-500/20 p-8 rounded-[40px] relative overflow-hidden">
          <div className="absolute inset-0 bg-red-600/[0.02] pointer-events-none" />
          <p className="text-[10px] font-black text-red-500 uppercase mb-2 tracking-widest flex items-center gap-2">
            <Trash2 size={12} /> Fuga por Merma
          </p>
          <h3 className="text-3xl font-black text-white">-{formatCurrency(stats.perdidaPorMerma)}</h3>
          <p className="text-[9px] text-red-700 font-bold mt-2 uppercase">Dinero perdido en basura</p>
        </div>

        {/* CARD: UTILIDAD NETA (EL ÉXITO REAL) */}
        <div className="bg-white text-black p-8 rounded-[40px] shadow-[0_20px_50px_rgba(255,255,255,0.1)]">
          <p className="text-[10px] font-black opacity-50 uppercase mb-2 tracking-widest">Ganancia Neta Real</p>
          <h3 className="text-4xl font-black italic tracking-tighter">{formatCurrency(stats.utilidadNeta)}</h3>
          <div className="flex items-center gap-2 mt-2">
            <TrendingUp size={14} className="text-green-600" />
            <p className="text-[10px] font-bold uppercase">{stats.margenReal.toFixed(1)}% Margen Real</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LISTADO DE MERMAS DEL DÍA */}
        <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 rounded-[50px] p-10">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-xl font-black uppercase italic tracking-tight">Top 5 <span className="text-red-500">Pérdidas</span></h4>
            <AlertCircle className="text-gray-700" size={20} />
          </div>

          <div className="space-y-4">
            {stats.topMermas.length > 0 ? stats.topMermas.map((m, idx) => (
              <div key={idx} className="flex justify-between items-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:border-red-500/30 transition-all">
                <div className="flex items-center gap-5">
                  <span className="text-gray-800 font-black italic text-2xl">{idx + 1}</span>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase">{m.categoria}</p>
                    <p className="text-sm font-black uppercase text-white">{m.nombre_producto}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-red-500">-{formatCurrency(m.total_perdida)}</p>
                  <p className="text-[9px] text-gray-600 uppercase font-bold">{m.cantidad} {m.unidad} • {m.motivo}</p>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center opacity-20">
                <Trash2 className="mx-auto mb-4" size={48} />
                <p className="text-xs font-black uppercase tracking-widest">Sin mermas registradas hoy</p>
              </div>
            )}
          </div>
        </div>

        {/* ANALÍTICA RÁPIDA */}
        <div className="bg-gradient-to-b from-[#0A0A0A] to-transparent border border-white/5 rounded-[50px] p-10 flex flex-col justify-between">
          <div>
            <h4 className="text-xl font-black uppercase italic tracking-tight mb-8">Resumen <span className="text-green-500">Estratégico</span></h4>
            <div className="space-y-8">
              <div>
                <p className="text-[9px] font-black text-gray-500 uppercase mb-2 tracking-widest">Eficiencia de Inventario</p>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-1000" 
                    style={{ width: `${Math.max(0, 100 - (stats.perdidaPorMerma / (stats.ventasTotales || 1) * 100))}%` }} 
                  />
                </div>
              </div>
              
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <p className="text-[9px] font-black text-gray-400 uppercase mb-3">Consejo Titanium</p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {stats.perdidaPorMerma > (stats.utilidadNeta * 0.2) 
                    ? "⚠️ Hugo, la merma está devorando más del 20% de tu ganancia. Revisa el stock de perecederos antes de ir a la Central." 
                    : "✅ Operación saludable. El nivel de desperdicio está bajo control respecto a las ventas."}
                </p>
              </div>
            </div>
          </div>

          <button 
            onClick={fetchData}
            className="w-full mt-10 py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center justify-center gap-3"
          >
            <RefreshCw size={14} /> Actualizar Datos
          </button>
        </div>
      </div>
    </div>
  );
}

// Icono faltante de Refresh
function RefreshCw({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
  );
}
