import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart3, TrendingUp, Calendar, ChevronRight, ArrowLeft, 
  DollarSign, X, Zap, Trash2, Clock, Truck, FileText, Package
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

type Periodo = '24h' | '7d' | '30d' | 'custom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'compras' | 'rentabilidad'>('rentabilidad');
  const [periodo, setPeriodo] = useState<Periodo>('24h');
  const [customDates, setCustomDates] = useState({ 
    start: format(new Date(), 'yyyy-MM-dd'), 
    end: format(new Date(), 'yyyy-MM-dd') 
  });
  
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [comprasPorProveedor, setComprasPorProveedor] = useState<any[]>([]);
  
  // Auditoría
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [selectedNota, setSelectedNota] = useState<any>(null);
  const [detalleNota, setDetalleNota] = useState<any[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => { fetchData(); }, [periodo, customDates]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let inicio = `${customDates.start}T00:00:00-06:00`;
      let fin = `${customDates.end}T23:59:59-06:00`;

      if (periodo === '24h') {
        const hoy = format(new Date(), 'yyyy-MM-dd');
        inicio = `${hoy}T00:00:00-06:00`;
        fin = `${hoy}T23:59:59-06:00`;
      } else if (periodo === '7d') {
        inicio = startOfDay(subDays(new Date(), 7)).toISOString();
      }

      const [resPedidos, resMermas, resProds, resComps, resProvs] = await Promise.all([
        supabase.from('pedidos').select('*').eq('estado', 'Finalizado').gte('created_at', inicio).lte('created_at', fin),
        supabase.from('merma').select('*').gte('created_at', inicio).lte('created_at', fin),
        supabase.from('productos').select('*'),
        supabase.from('compras').select('*').gte('created_at', inicio).lte('created_at', fin).order('created_at', { ascending: false }),
        supabase.from('proveedores').select('id, nombre')
      ]);

      if (resPedidos.data) setPedidos(resPedidos.data);
      if (resMermas.data) setMermas(resMermas.data);
      if (resProds.data) setProductos(resProds.data);
      
      if (resProvs.data && resComps.data) {
        const resumen = resProvs.data.map(prov => {
          // ✅ FILTRO TITANIUM: Agrupa notas por ID o por coincidencia de nombre (Central)
          const notasProv = resComps.data.filter(c => {
            const matchId = c.proveedor_id === prov.id;
            const esAbastoManual = prov.id === 1 && (
              c.proveedor?.toUpperCase().includes("ABASTO") || 
              c.proveedor?.toUpperCase().includes("CENTRAL")
            );
            return matchId || esAbastoManual;
          });

          const total = notasProv.reduce((acc, curr) => acc + (Number(curr.total) || Number(curr.total_compra) || 0), 0);
          return { ...prov, total, numNotas: notasProv.length, notas: notasProv };
        }).filter(p => p.total > 0 || p.numNotas > 0);
        setComprasPorProveedor(resumen);
      }

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const abrirDetalleNota = async (nota: any) => {
    setSelectedNota(nota);
    setLoadingDetalle(true);
    const { data } = await supabase.from('compras_detalle').select('*').eq('compra_id', nota.id);
    if (data) setDetalleNota(data);
    setLoadingDetalle(false);
  };

  const metrics = useMemo(() => {
    const ventasTotales = pedidos.reduce((acc, p) => acc + (p.total || 0), 0);
    const perdidaMermas = mermas.reduce((acc, m) => acc + (m.total_perdida || 0), 0);
    let costoVendido = 0;
    pedidos.forEach(p => {
      const items = Array.isArray(p.detalle_pedido) ? p.detalle_pedido : [];
      items.forEach((item: any) => {
        const prodMatch = productos.find(x => x.id === item.id || x.sku === item.sku);
        costoVendido += ((prodMatch?.costo || 0) * (item.quantity || 0));
      });
    });
    const utilidadReal = ventasTotales - costoVendido - perdidaMermas;
    return { ventasTotales, costoVendido, perdidaMermas, utilidadReal };
  }, [pedidos, mermas, productos]);

  if (loading) return <div className="p-20 text-center"><Zap className="text-green-500 animate-pulse mb-4" size={40} /><p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Auditoría...</p></div>;

  return (
    <div className="animate-in fade-in pb-20">
      {/* CALENDARIO DINÁMICO */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/10 p-3 rounded-2xl text-blue-500"><Calendar size={20} /></div>
            <div><h2 className="text-xl font-black uppercase italic text-white">Auditoría</h2></div>
          </div>
          <div className="flex gap-2 bg-black p-1.5 rounded-[22px] border border-white/5">
            {['24h', '7d', '30d', 'custom'].map(p => (
              <button key={p} onClick={() => setPeriodo(p as Periodo)} className={`px-6 py-2.5 rounded-[18px] text-[9px] font-black uppercase ${periodo === p ? 'bg-white text-black' : 'text-gray-500'}`}>{p}</button>
            ))}
          </div>
        </div>
        {periodo === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5">
            <input type="date" value={customDates.start} onChange={(e) => setCustomDates({...customDates, start: e.target.value})} className="bg-black border border-white/10 p-3 rounded-xl text-white outline-none text-xs" />
            <input type="date" value={customDates.end} onChange={(e) => setCustomDates({...customDates, end: e.target.value})} className="bg-black border border-white/10 p-3 rounded-xl text-white outline-none text-xs" />
            <button onClick={fetchData} className="bg-blue-600 text-white font-black uppercase text-[10px] rounded-xl">Filtrar</button>
          </div>
        )}
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px]"><p className="text-[8px] font-black text-gray-500 uppercase mb-1">Ventas</p><p className="text-2xl font-black">{formatCurrency(metrics.ventasTotales)}</p></div>
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px]"><p className="text-[8px] font-black text-gray-500 uppercase mb-1">Inversión</p><p className="text-2xl font-black text-gray-400">{formatCurrency(metrics.costoVendido)}</p></div>
        <div className="bg-red-600/5 border border-red-500/20 p-6 rounded-[35px]"><p className="text-[8px] font-black text-red-500 uppercase mb-1">Merma</p><p className="text-2xl font-black text-red-500">-{formatCurrency(metrics.perdidaMermas)}</p></div>
        <div className="bg-green-600/10 border border-green-500/30 p-6 rounded-[35px]"><p className="text-[8px] font-black text-green-500 uppercase mb-1">Utilidad</p><p className="text-3xl font-black text-white">{formatCurrency(metrics.utilidadReal)}</p></div>
        <div className="bg-white text-black p-6 rounded-[35px] flex flex-col justify-center items-center"><p className="text-[8px] font-black opacity-40 uppercase">Margen</p><p className="text-3xl font-black italic tracking-tighter">{metrics.ventasTotales > 0 ? ((metrics.utilidadReal / metrics.ventasTotales) * 100).toFixed(1) : 0}%</p></div>
      </div>

      {/* TABS */}
      <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-fit mb-10">
        <button onClick={() => setTab('rentabilidad')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase ${tab === 'rentabilidad' ? 'bg-white text-black' : 'text-gray-500'}`}>📈 Rentabilidad</button>
        <button onClick={() => setTab('compras')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase ${tab === 'compras' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>🛒 Historial</button>
      </div>

      {tab === 'rentabilidad' ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] overflow-hidden">
          <table className="w-full text-left">
            <thead><tr className="border-b border-white/5 bg-white/[0.02]"><th className="p-6 text-[9px] font-black uppercase text-gray-500">Producto</th><th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Inv</th><th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Venta</th><th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Margen</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {productos.filter(p => p.precio_venta > 0).map(p => {
                const mgn = ((p.precio_venta - (p.costo || 0)) / p.precio_venta) * 100;
                return (<tr key={p.id} className="hover:bg-white/[0.01]"><td className="p-6"><p className="text-xs font-black uppercase">{p.nombre}</p></td><td className="p-6 text-center text-xs text-gray-400">{formatCurrency(p.costo)}</td><td className="p-6 text-center text-xs font-black">{formatCurrency(p.precio_venta)}</td><td className="p-6 text-center"><span className="text-[10px] font-black px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full">{mgn.toFixed(1)}%</span></td></tr>);
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {!selectedProvider ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comprasPorProveedor.map(prov => (
                <button key={prov.id} onClick={() => setSelectedProvider(prov)} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between hover:border-blue-500 transition-all text-left">
                  <div className="flex items-center gap-6"><div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center"><Truck className="text-gray-500" size={24}/></div><div><p className="text-xl font-black uppercase italic">{prov.nombre}</p><p className="text-[9px] text-gray-600 font-black uppercase">{prov.numNotas} Notas</p></div></div>
                  <div className="text-right"><p className="text-xl font-black">{formatCurrency(prov.total)}</p><p className="text-[8px] text-blue-500 font-black uppercase">Ver Notas <ChevronRight size={12}/></p></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="animate-in slide-in-from-right">
              <button onClick={() => setSelectedProvider(null)} className="mb-8 flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl text-[10px] font-black uppercase"><ArrowLeft size={16}/> Volver</button>
              <h3 className="text-3xl font-black uppercase italic mb-8">Notas de <span className="text-blue-500">{selectedProvider.nombre}</span></h3>
              <div className="space-y-4">
                {selectedProvider.notas.map((nota: any) => (
                  <button key={nota.id} onClick={() => abrirDetalleNota(nota)} className="w-full bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between">
                    <div className="flex items-center gap-8"><div className="text-center min-w-[60px] border-r border-white/5 pr-8"><p className="text-[9px] font-black text-gray-600 uppercase">{format(new Date(nota.created_at), 'MMM')}</p><p className="text-2xl font-black">{format(new Date(nota.created_at), 'dd')}</p></div><h4 className="text-xl font-black uppercase">{nota.folio || 'S/F'}</h4></div>
                    <div className="text-right"><p className="text-3xl font-black tracking-tighter">{formatCurrency(nota.total || nota.total_compra)}</p></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLE */}
      {selectedNota && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
           <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 w-full max-w-4xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setSelectedNota(null)} className="absolute top-10 right-10 text-gray-500"><X size={28}/></button>
              <h2 className="text-4xl font-black uppercase italic mb-8">{selectedProvider.nombre}</h2>
              <div className="bg-black border border-white/5 rounded-[45px] overflow-hidden mb-10">
                 {loadingDetalle ? <div className="py-20 text-center text-xs font-black uppercase">Cargando...</div> : (
                   <table className="w-full text-left">
                     <thead className="bg-white/5"><tr className="text-[9px] font-black uppercase text-gray-500"><th className="p-6">Producto</th><th className="p-6 text-center">Cant</th><th className="p-6 text-right">Subtotal</th></tr></thead>
                     <tbody className="divide-y divide-white/[0.03]">
                       {detalleNota.map((item, idx) => (
                         <tr key={idx}><td className="p-6 text-xs font-black uppercase">{item.nombre}</td><td className="p-6 text-center text-sm font-black text-blue-400">{item.cantidad}</td><td className="p-6 text-right text-lg font-black">{formatCurrency(item.subtotal)}</td></tr>
                       ))}
                     </tbody>
                   </table>
                 )}
              </div>
              <div className="flex justify-between items-center p-8 bg-white/5 rounded-[40px]">
                 <div><p className="text-[10px] font-black uppercase text-gray-500 mb-1">Total Liquidado</p><p className="text-4xl font-black italic">{formatCurrency(selectedNota.total || selectedNota.total_compra)}</p></div>
                 <button onClick={() => setSelectedNota(null)} className="bg-white text-black px-10 py-5 rounded-[25px] font-black uppercase text-[10px]">Cerrar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
