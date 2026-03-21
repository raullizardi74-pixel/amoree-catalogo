import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart3, TrendingUp, Calendar, ChevronRight, ArrowLeft, 
  Hash, Truck, PieChart, Target, DollarSign, X, Zap 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'compras' | 'rentabilidad'>('compras');
  const [showAuditoria, setShowAuditoria] = useState(false);
  
  // Estados de datos
  const [comprasPorProveedor, setComprasPorProveedor] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [detalleCompra, setDetalleCompra] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Traemos todo lo necesario: Proveedores, Compras y Productos
    const { data: provs } = await supabase.from('proveedores').select('id, nombre');
    const { data: comps } = await supabase.from('compras').select('*');
    const { data: prods } = await supabase.from('productos').select('*');

    if (provs && comps) {
      const resumen = provs.map(prov => {
        const total = comps
          .filter(c => c.proveedor_id === prov.id)
          .reduce((acc, curr) => acc + Number(curr.total), 0);
        const numNotas = comps.filter(c => c.proveedor_id === prov.id).length;
        return { ...prov, total, numNotas };
      }).filter(p => p.total > 0);
      
      setComprasPorProveedor(resumen);
    }
    if (prods) setProductos(prods);
    setLoading(false);
  };

  const verDetalleProveedor = async (provider: any) => {
    setLoading(true);
    setSelectedProvider(provider);
    const { data } = await supabase
      .from('compras')
      .select(`id, created_at, folio, total, compras_detalle (*)`)
      .eq('proveedor_id', provider.id)
      .order('created_at', { ascending: false });
    
    if (data) setDetalleCompra(data);
    setLoading(false);
  };

  // --- LÓGICA DE CÁLCULO FINANCIERO (Métricas de Envidia) ---
  const statsRentabilidad = () => {
    // 1. Inversión Total (Lo que hay en estantes a precio de costo)
    const totalInversion = productos.reduce((acc, p) => acc + ((p.costo || 0) * (p.stock_actual || 0)), 0);
    
    // 2. Valor de Venta Potencial (Lo que Hugo cobrará si vende todo)
    const totalVentaPotencial = productos.reduce((acc, p) => acc + ((p.precio_venta || 0) * (p.stock_actual || 0)), 0);
    
    // 3. Utilidad Bruta Proyectada
    const gananciaProyectada = totalVentaPotencial - totalInversion;
    
    // 4. Margen de Contribución Promedio
    const margenPromedio = totalVentaPotencial > 0 ? (gananciaProyectada / totalVentaPotencial) * 100 : 0;

    return { totalInversion, totalVentaPotencial, gananciaProyectada, margenPromedio };
  };

  const { totalInversion, totalVentaPotencial, gananciaProyectada, margenPromedio } = statsRentabilidad();

  if (selectedProvider) {
    return (
      <div className="animate-in slide-in-from-right duration-500">
        <button onClick={() => setSelectedProvider(null)} className="mb-8 text-gray-500 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
          <ArrowLeft size={16}/> Volver a Resumen
        </button>
        <div className="mb-10">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Historial: <span className="text-green-500">{selectedProvider.nombre}</span></h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase mt-2">Inversión Total: {formatCurrency(selectedProvider.total)}</p>
        </div>
        <div className="space-y-6">
          {detalleCompra.map((compra) => (
            <div key={compra.id} className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl"><Calendar className="text-gray-400" size={20}/></div>
                  <div>
                    <p className="text-white font-black text-sm uppercase italic">{format(new Date(compra.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
                    <p className="text-[9px] text-green-500 font-black tracking-widest flex items-center gap-1 uppercase mt-1"><Hash size={10}/> Folio: {compra.folio}</p>
                  </div>
                </div>
                <p className="text-2xl font-black text-white">{formatCurrency(compra.total)}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {compra.compras_detalle?.map((item: any) => (
                  <div key={item.id} className="bg-black/40 p-4 rounded-2xl flex justify-between items-center border border-white/[0.02]">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-300">{item.nombre}</p>
                      <p className="text-[8px] text-gray-600 font-bold uppercase">Cant: {item.cantidad} x {formatCurrency(item.costo_unitario)}</p>
                    </div>
                    <p className="text-xs font-black text-white">{formatCurrency(item.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      {/* HEADER DE MÉTRICAS */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] p-10 mb-10 flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-3">
            Amoree <span className="text-green-500">Analytics</span>
          </h2>
          <p className="text-[9px] text-gray-500 font-black tracking-[0.4em] uppercase mt-2">Inteligencia de Negocios</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
           <div className="flex bg-black p-2 rounded-3xl border border-white/5 gap-2">
              <button onClick={() => setTab('compras')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'compras' ? 'bg-white text-black' : 'text-gray-500'}`}>🛒 Compras</button>
              <button onClick={() => setTab('rentabilidad')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'rentabilidad' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-gray-500'}`}>📈 Utilidad</button>
           </div>
           {/* ✅ BOTÓN DE RESUMEN EJECUTIVO (TIPO CORTE DE CAJA) */}
           <button onClick={() => setShowAuditoria(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all">
             <PieChart size={16}/> Resumen Ejecutivo
           </button>
        </div>
      </div>

      {tab === 'compras' ? (
        <div className="space-y-4">
          <div className="bg-blue-600/10 border border-blue-500/20 p-8 rounded-[40px] mb-8">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Inversión Analizada</p>
            <p className="text-5xl font-black italic tracking-tighter">
              {formatCurrency(comprasPorProveedor.reduce((acc, c) => acc + c.total, 0))}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comprasPorProveedor.map(prov => (
              <button key={prov.id} onClick={() => verDetalleProveedor(prov)} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between group hover:border-green-500/30 transition-all text-left">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-green-500/10 transition-colors">
                      <Truck className="text-gray-500 group-hover:text-green-500" size={24}/>
                   </div>
                   <div>
                      <p className="text-xl font-black uppercase italic tracking-tight">{prov.nombre}</p>
                      <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mt-1">{prov.numNotas} Notas registradas</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-xl font-black text-white">{formatCurrency(prov.total)}</p>
                   <p className="text-[8px] text-green-500 font-black uppercase mt-1 flex items-center justify-end gap-1">Auditar <ChevronRight size={12}/></p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ✅ PESTAÑA DE UTILIDAD ACTIVA */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Ganancia en Bolsa (Proyectada)</p>
                <p className="text-4xl font-black text-green-500">{formatCurrency(gananciaProyectada)}</p>
                <p className="text-[9px] text-gray-600 mt-2 uppercase italic">Si vendes todo tu stock actual</p>
             </div>
             <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Margen Bruto Promedio</p>
                <p className="text-4xl font-black text-blue-500">{margenPromedio.toFixed(1)}%</p>
                <p className="text-[9px] text-gray-600 mt-2 uppercase italic">Rentabilidad operativa de Amoree</p>
             </div>
             <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Valor de Anaquel</p>
                <p className="text-4xl font-black text-white">{formatCurrency(totalVentaPotencial)}</p>
                <p className="text-[9px] text-gray-600 mt-2 uppercase italic">Total de mercancía a precio venta</p>
             </div>
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-6 text-[10px] font-black uppercase text-gray-500">Producto</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-500">Costo vs Venta</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-500">Ganancia $</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-500">Margen %</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-500">Indicador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {productos.filter(p => p.precio_venta > 0).sort((a,b) => (b.precio_venta - b.costo) - (a.precio_venta - a.costo)).map(p => {
                  const ganancia = p.precio_venta - (p.costo || 0);
                  const mgn = p.precio_venta > 0 ? (ganancia / p.precio_venta) * 100 : 0;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-6">
                        <p className="text-xs font-black uppercase italic">{p.nombre}</p>
                        <p className="text-[8px] text-gray-600 uppercase">Stock: {p.stock_actual} {p.unidad}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                           <span className="text-[9px] text-gray-500 font-bold">C: {formatCurrency(p.costo)}</span>
                           <span className="text-xs font-black text-white">V: {formatCurrency(p.precio_venta)}</span>
                        </div>
                      </td>
                      <td className="p-6 text-sm font-black text-green-500">{formatCurrency(ganancia)}</td>
                      <td className={`p-6 text-xs font-black ${mgn > 25 ? 'text-blue-400' : 'text-yellow-500'}`}>{mgn.toFixed(1)}%</td>
                      <td className="p-6">
                        {mgn > 25 ? (
                          <span className="bg-blue-500/10 text-blue-500 text-[8px] px-2 py-1 rounded-full font-black uppercase flex items-center gap-1 w-fit"><Zap size={10}/> Estrella</span>
                        ) : (
                          <span className="bg-gray-500/10 text-gray-400 text-[8px] px-2 py-1 rounded-full font-black uppercase w-fit">Regular</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🏦 MODAL RESUMEN EJECUTIVO (AUDITORÍA DE RENTABILIDAD) */}
      {showAuditoria && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#0F0F0F] border border-white/10 rounded-[50px] p-10 w-full max-w-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowAuditoria(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white"><X/></button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-blue-600 p-4 rounded-3xl shadow-lg shadow-blue-900/40"><Target className="text-white" size={24}/></div>
              <div>
                <h2 className="text-3xl font-black uppercase italic leading-none">Auditoría <span className="text-blue-500">Ejecutiva</span></h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Situación Financiera al {format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-10">
               <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Inversión Total en Stock</p>
                  <p className="text-2xl font-black">{formatCurrency(totalInversion)}</p>
               </div>
               <div className="bg-green-600/10 p-6 rounded-3xl border border-green-500/20">
                  <p className="text-[9px] font-black text-green-500 uppercase mb-1">Ganancia Neta Esperada</p>
                  <p className="text-2xl font-black text-green-400">{formatCurrency(gananciaProyectada)}</p>
               </div>
            </div>

            <div className="space-y-4 mb-10">
               <h3 className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] border-b border-white/5 pb-2">Desglose de Compras (Top 3 Proveedores)</h3>
               {comprasPorProveedor.sort((a,b) => b.total - a.total).slice(0,3).map(prov => (
                 <div key={prov.id} className="flex justify-between items-center">
                    <p className="text-xs font-black uppercase italic">{prov.nombre}</p>
                    <p className="text-xs font-bold text-white">{formatCurrency(prov.total)}</p>
                 </div>
               ))}
            </div>

            <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/20 mb-10">
               <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase">ROI de Inventario</p>
                    <p className="text-[8px] text-blue-500/60 uppercase">Retorno por cada $1 invertido</p>
                  </div>
                  <p className="text-3xl font-black text-blue-400">
                    {totalInversion > 0 ? (totalVentaPotencial / totalInversion).toFixed(2) : 0}x
                  </p>
               </div>
            </div>

            <button onClick={() => window.print()} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gray-200 transition-colors">Imprimir Reporte Ejecutivo</button>
          </div>
        </div>
      )}
    </div>
  );
}
