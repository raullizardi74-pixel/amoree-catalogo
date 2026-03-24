import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart3, TrendingUp, Calendar, ChevronRight, ArrowLeft, 
  Hash, Truck, PieChart, DollarSign, X, Zap, Trash2, Filter, Clock, FileText, Package
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
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
  
  // Estados de datos
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [todasLasCompras, setTodasLasCompras] = useState<any[]>([]);
  const [comprasPorProveedor, setComprasPorProveedor] = useState<any[]>([]);
  
  // Estados de Navegación (Auditoría)
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [selectedNota, setSelectedNota] = useState<any>(null);
  const [detalleNota, setDetalleNota] = useState<any[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodo, customDates]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Definir Rango de Tiempo (Ajustado a México CST)
      let inicio = `${customDates.start}T00:00:00-06:00`;
      let fin = `${customDates.end}T23:59:59-06:00`;

      if (periodo === '24h') {
        const hoy = format(new Date(), 'yyyy-MM-dd');
        inicio = `${hoy}T00:00:00-06:00`;
        fin = `${hoy}T23:59:59-06:00`;
      } else if (periodo === '7d') {
        inicio = startOfDay(subDays(new Date(), 7)).toISOString();
      } else if (periodo === '30d') {
        inicio = startOfDay(subDays(new Date(), 30)).toISOString();
      }

      // 2. Carga de datos
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
      if (resComps.data) setTodasLasCompras(resComps.data);
      
      if (resProvs.data && resComps.data) {
        const resumen = resProvs.data.map(prov => {
          const notasProv = resComps.data.filter(c => c.proveedor_id === prov.id);
          const total = notasProv.reduce((acc, curr) => acc + (Number(curr.total) || Number(curr.total_compra) || 0), 0);
          return { ...prov, total, numNotas: notasProv.length, notas: notasProv };
        }).filter(p => p.total > 0 || p.numNotas > 0);
        setComprasPorProveedor(resumen);
      }

    } catch (e) { console.error("Error en Dashboard:", e); } 
    finally { setLoading(false); }
  };

  // ✅ CARGA DE DETALLE DE NOTA ESPECÍFICA
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
    const utilidadBruta = ventasTotales - costoVendido;
    const utilidadReal = utilidadBruta - perdidaMermas;
    return { ventasTotales, costoVendido, perdidaMermas, utilidadReal };
  }, [pedidos, mermas, productos]);

  if (loading) return <div className="p-20 text-center"><Zap className="mx-auto text-green-500 animate-pulse mb-4" size={40} /><p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Sincronizando Auditoría...</p></div>;

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      {/* 📅 CALENDARIO DINÁMICO TITANIUM */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/10 p-3 rounded-2xl text-blue-500"><Calendar size={20} /></div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Periodo de Auditoría</h2>
              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Afecta métricas e historial</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 bg-black p-1.5 rounded-[22px] border border-white/5">
            {[
              { id: '24h', label: 'Hoy' },
              { id: '7d', label: '7 Días' },
              { id: '30d', label: '30 Días' },
              { id: 'custom', label: 'Calendario' }
            ].map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id as Periodo)} className={`px-6 py-2.5 rounded-[18px] text-[9px] font-black uppercase transition-all ${periodo === p.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>{p.label}</button>
            ))}
          </div>
        </div>

        {periodo === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5 animate-in slide-in-from-top duration-300">
            <div className="bg-black border border-white/10 p-4 rounded-2xl text-center">
              <label className="text-[7px] font-black text-gray-500 uppercase block mb-2">Desde</label>
              <input type="date" value={customDates.start} onChange={(e) => setCustomDates({...customDates, start: e.target.value})} className="bg-transparent text-white font-black outline-none text-sm cursor-pointer" />
            </div>
            <div className="bg-black border border-white/10 p-4 rounded-2xl text-center">
              <label className="text-[7px] font-black text-gray-500 uppercase block mb-2">Hasta</label>
              <input type="date" value={customDates.end} onChange={(e) => setCustomDates({...customDates, end: e.target.value})} className="bg-transparent text-white font-black outline-none text-sm cursor-pointer" />
            </div>
            <button onClick={fetchData} className="bg-blue-600 text-white font-black uppercase text-[10px] rounded-2xl hover:bg-blue-500 active:scale-95 transition-all">Actualizar Vista</button>
          </div>
        )}
      </div>

      {/* TARJETAS MAESTRAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px] relative overflow-hidden group">
          <p className="text-[8px] font-black text-gray-500 uppercase mb-1 tracking-widest">Ingresos</p>
          <p className="text-2xl font-black text-white">{formatCurrency(metrics.ventasTotales)}</p>
          <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
        </div>
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px]">
          <p className="text-[8px] font-black text-gray-500 uppercase mb-1 tracking-widest">Inversión (Costo)</p>
          <p className="text-2xl font-black text-gray-300">{formatCurrency(metrics.costoVendido)}</p>
        </div>
        <div className="bg-red-600/5 border border-red-500/20 p-6 rounded-[35px] relative overflow-hidden">
          <p className="text-[8px] font-black text-red-500 uppercase mb-1 tracking-widest flex items-center gap-1"><Trash2 size={10}/> Merma</p>
          <p className="text-2xl font-black text-red-500">-{formatCurrency(metrics.perdidaMermas)}</p>
          <div className="absolute -right-2 -bottom-2 opacity-5 text-red-500"><Trash2 size={80}/></div>
        </div>
        <div className="bg-green-600/10 border border-green-500/30 p-6 rounded-[35px] shadow-lg shadow-green-900/10">
          <p className="text-[8px] font-black text-green-500 uppercase mb-1 tracking-widest">Utilidad Real</p>
          <p className="text-3xl font-black text-white">{formatCurrency(metrics.utilidadReal)}</p>
          <p className="text-[7px] text-green-600 font-black uppercase mt-1 italic">Neto Final</p>
        </div>
        <div className="bg-white text-black p-6 rounded-[35px] flex flex-col justify-center items-center">
          <p className="text-[8px] font-black opacity-40 uppercase mb-1">Margen Real</p>
          <p className="text-3xl font-black italic tracking-tighter">{metrics.ventasTotales > 0 ? ((metrics.utilidadReal / metrics.ventasTotales) * 100).toFixed(1) : 0}%</p>
        </div>
      </div>

      {/* TABS NAVEGACIÓN */}
      <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-fit mb-10">
        <button onClick={() => setTab('rentabilidad')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'rentabilidad' ? 'bg-white text-black' : 'text-gray-500'}`}>📈 Rentabilidad</button>
        <button onClick={() => setTab('compras')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'compras' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>🛒 Historial de Auditoría</button>
      </div>

      {tab === 'rentabilidad' ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] overflow-hidden">
          <table className="w-full text-left">
            <thead><tr className="border-b border-white/5 bg-white/[0.02]"><th className="p-6 text-[9px] font-black uppercase text-gray-500">Producto</th><th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Inv. Unit</th><th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Venta Unit</th><th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Margen</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {productos.filter(p => p.precio_venta > 0).map(p => {
                const mgn = ((p.precio_venta - (p.costo || 0)) / p.precio_venta) * 100;
                return (<tr key={p.id} className="hover:bg-white/[0.01] transition-colors"><td className="p-6"><p className="text-xs font-black uppercase italic">{p.nombre}</p><p className="text-[8px] text-gray-600 uppercase">Stock: {p.stock_actual}</p></td><td className="p-6 text-center text-xs font-bold text-gray-400">{formatCurrency(p.costo)}</td><td className="p-6 text-center text-xs font-black text-white">{formatCurrency(p.precio_venta)}</td><td className="p-6 text-center"><span className={`text-[10px] font-black px-3 py-1 rounded-full ${mgn > 25 ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}`}>{mgn.toFixed(1)}%</span></td></tr>);
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ✅ NIVEL 1 Y 2: HISTORIAL DE COMPRAS (AUDITORÍA DE "TALADRO") */
        <div>
          {!selectedProvider ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
              {comprasPorProveedor.map(prov => (
                <button key={prov.id} onClick={() => setSelectedProvider(prov)} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between hover:border-blue-500 transition-all text-left group">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600/10 text-gray-500 group-hover:text-blue-500"><Truck size={24}/></div>
                    <div><p className="text-xl font-black uppercase italic">{prov.nombre}</p><p className="text-[9px] text-gray-600 font-black uppercase mt-1">{prov.numNotas} Notas detectadas</p></div>
                  </div>
                  <div className="text-right"><p className="text-xl font-black text-white">{formatCurrency(prov.total)}</p><p className="text-[8px] text-blue-500 font-black uppercase mt-1 flex items-center justify-end gap-1">Ver Notas <ChevronRight size={12}/></p></div>
                </button>
              ))}
            </div>
          ) : (
            <div className="animate-in slide-in-from-right duration-500">
              <button onClick={() => setSelectedProvider(null)} className="mb-8 flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-white/10 transition-all border border-white/5"><ArrowLeft size={16}/> Volver a Proveedores</button>
              <div className="flex items-center gap-4 mb-10">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter">Notas de <span className="text-blue-500">{selectedProvider.nombre}</span></h3>
              </div>
              <div className="space-y-4">
                {selectedProvider.notas.map((nota: any) => (
                  <button key={nota.id} onClick={() => abrirDetalleNota(nota)} className="w-full bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between hover:bg-white/[0.02] transition-all text-left group">
                    <div className="flex items-center gap-8">
                       <div className="text-center min-w-[60px] border-r border-white/5 pr-8">
                          <p className="text-[9px] font-black text-gray-600 uppercase mb-1">{format(new Date(nota.created_at), 'MMM')}</p>
                          <p className="text-2xl font-black text-white">{format(new Date(nota.created_at), 'dd')}</p>
                       </div>
                       <div>
                          <p className="text-[9px] text-blue-500 font-black uppercase tracking-[0.2em] mb-1">Folio / Remisión</p>
                          <h4 className="text-xl font-black uppercase italic">{nota.folio || 'SIN FOLIO'}</h4>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] text-gray-600 font-black uppercase mb-1">Inversión Nota</p>
                       <p className="text-3xl font-black text-white tracking-tighter">{formatCurrency(nota.total || nota.total_compra)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✅ NIVEL 3: EL GRAN MODAL DE AUDITORÍA (DETALLE DE NOTA) */}
      {selectedNota && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-[#0A0A0A] border border-white/10 rounded-[60px] p-10 md:p-14 w-full max-w-4xl relative shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh]">
              <button onClick={() => setSelectedNota(null)} className="absolute top-10 right-10 text-gray-500 hover:text-white transition-all active:rotate-90"><X size={28}/></button>
              
              <div className="mb-12">
                 <div className="flex items-center gap-3 text-blue-500 mb-2"><Package size={20}/><span className="text-[10px] font-black uppercase tracking-[0.4em]">Auditoría de Mercancía</span></div>
                 <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">{selectedProvider.nombre}</h2>
                 <p className="text-[10px] text-gray-500 font-black uppercase mt-4 tracking-widest bg-white/5 w-fit px-4 py-2 rounded-xl">Folio: {selectedNota.folio} • {format(new Date(selectedNota.created_at), "dd 'de' MMMM 'a las' HH:mm 'hrs'", {locale: es})}</p>
              </div>

              <div className="bg-black border border-white/5 rounded-[45px] overflow-hidden mb-10">
                 {loadingDetalle ? (
                   <div className="py-20 text-center animate-pulse text-[10px] font-black uppercase text-gray-600 tracking-widest">Consultando Supabase...</div>
                 ) : (
                   <table className="w-full text-left">
                     <thead className="bg-white/5 border-b border-white/5">
                       <tr>
                         <th className="p-6 text-[9px] font-black uppercase text-gray-500">Producto</th>
                         <th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Cant</th>
                         <th className="p-6 text-[9px] font-black uppercase text-gray-500 text-right">Costo Unit.</th>
                         <th className="p-6 text-[9px] font-black uppercase text-gray-500 text-right">Subtotal</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/[0.03]">
                       {detalleNota.map((item, idx) => (
                         <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                           <td className="p-6"><p className="text-[11px] font-black uppercase text-white leading-tight">{item.nombre}</p><p className="text-[8px] text-gray-600 uppercase mt-1">SKU: {item.sku || 'N/A'}</p></td>
                           <td className="p-6 text-center text-sm font-black text-blue-400">{item.cantidad}</td>
                           <td className="p-6 text-right text-sm font-black">{formatCurrency(item.costo_unitario)}</td>
                           <td className="p-6 text-right text-lg font-black text-white">{formatCurrency(item.subtotal)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 )}
              </div>

              <div className="flex justify-between items-center p-8 bg-white/5 rounded-[40px] border border-white/10">
                 <div><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Liquidado</p><p className="text-4xl font-black italic tracking-tighter text-white">{formatCurrency(selectedNota.total || selectedNota.total_compra)}</p></div>
                 <button onClick={() => setSelectedNota(null)} className="bg-white text-black px-10 py-5 rounded-[25px] font-black uppercase text-[10px] tracking-widest hover:bg-green-500 transition-all">Cerrar Auditoría</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
