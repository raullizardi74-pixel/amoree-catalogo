import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  BarChart3, TrendingUp, Calendar, ChevronRight, ArrowLeft, 
  Hash, Truck, PieChart, Target, DollarSign, X, Zap, Trash2, Filter, Clock
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

type Periodo = '24h' | '7d' | '30d' | 'custom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'compras' | 'rentabilidad'>('rentabilidad');
  const [periodo, setPeriodo] = useState<Periodo>('24h');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  
  // Estados de datos
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [comprasPorProveedor, setComprasPorProveedor] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [detalleCompra, setDetalleCompra] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [periodo, customDates]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Definir Rango de Tiempo
      let fechaInicio = startOfDay(subDays(new Date(), 1)).toISOString(); // Default 24h
      const ahora = new Date().toISOString();

      if (periodo === '7d') fechaInicio = subDays(new Date(), 7).toISOString();
      if (periodo === '30d') fechaInicio = subDays(new Date(), 30).toISOString();
      if (periodo === 'custom' && customDates.start) fechaInicio = new Date(customDates.start).toISOString();
      
      const fechaFin = (periodo === 'custom' && customDates.end) ? new Date(customDates.end).toISOString() : ahora;

      // 2. Carga Multidimensional (Pedidos, Mermas, Productos, Compras)
      const [resPedidos, resMermas, resProds, resComps, resProvs] = await Promise.all([
        supabase.from('pedidos').select('*').eq('estado', 'Finalizado').gte('created_at', fechaInicio).lte('created_at', fechaFin),
        supabase.from('merma').select('*').gte('created_at', fechaInicio).lte('created_at', fechaFin),
        supabase.from('productos').select('*'),
        supabase.from('compras').select('*'),
        supabase.from('proveedores').select('id, nombre')
      ]);

      if (resPedidos.data) setPedidos(resPedidos.data);
      if (resMermas.data) setMermas(resMermas.data);
      if (resProds.data) setProductos(resProds.data);
      
      // Procesar compras por proveedor (Histórico General)
      if (resProvs.data && resComps.data) {
        const resumen = resProvs.data.map(prov => {
          const total = resComps.data.filter(c => c.proveedor_id === prov.id).reduce((acc, curr) => acc + Number(curr.total), 0);
          return { ...prov, total, numNotas: resComps.data.filter(c => c.proveedor_id === prov.id).length };
        }).filter(p => p.total > 0);
        setComprasPorProveedor(resumen);
      }

    } catch (e) {
      console.error("Error en Dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  // 🧠 CÁLCULOS DE RENTABILIDAD REAL (Basado en el periodo seleccionado)
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

  if (loading) return (
    <div className="p-20 text-center">
      <Zap className="mx-auto text-green-500 animate-pulse mb-4" size={40} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Sincronizando Métricas...</p>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-700">
      {/* SECTOR DE FILTROS TEMPORALES */}
      <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-green-600/10 p-3 rounded-2xl text-green-500">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">Rango de Análisis</h2>
              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Afecta Ventas y Mermas</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 bg-black p-1.5 rounded-[22px] border border-white/5">
            {[
              { id: '24h', label: 'Hoy (24h)' },
              { id: '7d', label: '7 Días' },
              { id: '30d', label: '30 Días' },
              { id: 'custom', label: 'Personalizado' }
            ].map(p => (
              <button 
                key={p.id} onClick={() => setPeriodo(p.id as Periodo)}
                className={`px-6 py-2.5 rounded-[18px] text-[9px] font-black uppercase transition-all ${periodo === p.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {periodo === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/5 animate-in slide-in-from-top duration-300">
            <div className="bg-black border border-white/10 p-3 rounded-2xl">
              <label className="text-[8px] font-black text-gray-500 uppercase block mb-1 ml-2">Fecha Inicio</label>
              <input type="date" value={customDates.start} onChange={(e) => setCustomDates({...customDates, start: e.target.value})} className="bg-transparent text-white w-full outline-none text-xs px-2" />
            </div>
            <div className="bg-black border border-white/10 p-3 rounded-2xl">
              <label className="text-[8px] font-black text-gray-500 uppercase block mb-1 ml-2">Fecha Fin</label>
              <input type="date" value={customDates.end} onChange={(e) => setCustomDates({...customDates, end: e.target.value})} className="bg-transparent text-white w-full outline-none text-xs px-2" />
            </div>
            <button onClick={fetchData} className="bg-green-600 text-white font-black uppercase text-[10px] rounded-2xl hover:bg-green-500">Aplicar Filtro</button>
          </div>
        )}
      </div>

      {/* ✅ LAS 5 TARJETAS MAESTRAS (TITANIUM) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {/* VENTAS */}
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px] relative overflow-hidden group">
          <p className="text-[8px] font-black text-gray-500 uppercase mb-1 tracking-widest">Ingresos</p>
          <p className="text-2xl font-black text-white">{formatCurrency(metrics.ventasTotales)}</p>
          <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
        </div>

        {/* COSTO VENDIDO */}
        <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px]">
          <p className="text-[8px] font-black text-gray-500 uppercase mb-1 tracking-widest">Costo Invertido</p>
          <p className="text-2xl font-black text-gray-300">{formatCurrency(metrics.costoVendido)}</p>
        </div>

        {/* MERMA (LA NUEVA TARJETA ROJA) */}
        <div className="bg-red-600/5 border border-red-500/20 p-6 rounded-[35px] relative overflow-hidden">
          <p className="text-[8px] font-black text-red-500 uppercase mb-1 tracking-widest flex items-center gap-1"><Trash2 size={10}/> Merma</p>
          <p className="text-2xl font-black text-red-500">-{formatCurrency(metrics.perdidaMermas)}</p>
          <div className="absolute -right-2 -bottom-2 opacity-5 text-red-500"><Trash2 size={80}/></div>
        </div>

        {/* UTILIDAD REAL */}
        <div className="bg-green-600/10 border border-green-500/30 p-6 rounded-[35px] shadow-[0_10px_30px_rgba(34,197,94,0.1)]">
          <p className="text-[8px] font-black text-green-500 uppercase mb-1 tracking-widest">Utilidad Real</p>
          <p className="text-3xl font-black text-white">{formatCurrency(metrics.utilidadReal)}</p>
          <p className="text-[7px] text-green-600 font-black uppercase mt-1 italic">Neto descontando mermas</p>
        </div>

        {/* MARGEN */}
        <div className="bg-white text-black p-6 rounded-[35px] flex flex-col justify-center items-center">
          <p className="text-[8px] font-black opacity-40 uppercase mb-1">Margen Real</p>
          <p className="text-3xl font-black italic tracking-tighter">
            {metrics.ventasTotales > 0 ? ((metrics.utilidadReal / metrics.ventasTotales) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* RESTO DEL COMPONENTE (TABS Y TABLAS) */}
      <div className="flex bg-[#0A0A0A] p-2 rounded-[30px] border border-white/5 gap-2 w-fit mb-10">
        <button onClick={() => setTab('rentabilidad')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'rentabilidad' ? 'bg-white text-black' : 'text-gray-500'}`}>📈 Rentabilidad por Producto</button>
        <button onClick={() => setTab('compras')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'compras' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>🛒 Historial de Compras</button>
      </div>

      {tab === 'rentabilidad' ? (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-6 text-[9px] font-black uppercase text-gray-500">Producto</th>
                <th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Inversión Unit.</th>
                <th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Venta Unit.</th>
                <th className="p-6 text-[9px] font-black uppercase text-gray-500 text-center">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {productos.filter(p => p.precio_venta > 0).map(p => {
                const ganancia = p.precio_venta - (p.costo || 0);
                const mgn = (ganancia / p.precio_venta) * 100;
                return (
                  <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-6">
                      <p className="text-xs font-black uppercase italic">{p.nombre}</p>
                      <p className="text-[8px] text-gray-600 uppercase">Stock: {p.stock_actual} {p.unidad}</p>
                    </td>
                    <td className="p-6 text-center text-xs font-bold text-gray-400">{formatCurrency(p.costo)}</td>
                    <td className="p-6 text-center text-xs font-black text-white">{formatCurrency(p.precio_venta)}</td>
                    <td className="p-6 text-center">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full ${mgn > 25 ? 'bg-blue-500/10 text-blue-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                        {mgn.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* VISTA DE COMPRAS (Mantiene tu lógica original por proveedor) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom">
           {comprasPorProveedor.map(prov => (
              <button key={prov.id} onClick={() => setSelectedProvider(prov)} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between hover:border-blue-500/30 transition-all text-left group">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600/10"><Truck className="text-gray-500 group-hover:text-blue-500" size={24}/></div>
                   <div>
                     <p className="text-xl font-black uppercase italic tracking-tight">{prov.nombre}</p>
                     <p className="text-[9px] text-gray-600 font-black uppercase mt-1">{prov.numNotas} Notas registradas</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-xl font-black text-white">{formatCurrency(prov.total)}</p>
                   <p className="text-[8px] text-blue-500 font-black uppercase mt-1 flex items-center justify-end gap-1">Ver Notas <ChevronRight size={12}/></p>
                </div>
              </button>
           ))}
        </div>
      )}
    </div>
  );
}
