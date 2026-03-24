import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Search, Calendar, ArrowLeft, Download, Filter, 
  TrendingUp, DollarSign, Trash2, ShoppingBag, 
  CreditCard, Smartphone, BookOpen, ChevronRight, Zap, Package
} from 'lucide-react';
import { format } from 'date-fns';

export default function AuditoriaModule({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [range, setRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchAuditData();
  }, [range]);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      // ✅ FORZAMOS HORARIO LOCAL PARA PRECISIÓN TOTAL
      const inicio = new Date(range.start + 'T00:00:00').toISOString();
      const fin = new Date(range.end + 'T23:59:59').toISOString();

      const { data: p } = await supabase.from('pedidos')
        .select('*')
        .gte('created_at', inicio)
        .lte('created_at', fin)
        .order('created_at', { ascending: false });

      const { data: m } = await supabase.from('merma')
        .select('*')
        .gte('created_at', inicio)
        .lte('created_at', fin);

      if (p) setPedidos(p);
      if (m) setMermas(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const finalizados = pedidos.filter(o => o.estado === 'Finalizado');
    const ventasTotales = finalizados.reduce((acc, o) => acc + (o.total || 0), 0);
    const perdidaMerma = mermas.reduce((acc, m) => acc + (m.total_perdida || 0), 0);
    
    const porMetodo = finalizados.reduce((acc: any, o) => {
      const m = o.metodo_pago || 'Efectivo';
      acc[m] = (acc[m] || 0) + (o.total || 0);
      return acc;
    }, {});

    return { ventasTotales, perdidaMerma, porMetodo, count: finalizados.length };
  }, [pedidos, mermas]);

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">Auditoría <span className="text-green-500">Financiera</span></h2>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] mt-1 italic">Control de Flujo Local</p>
          </div>
        </div>

        <div className="flex bg-[#0A0A0A] p-2 rounded-[25px] border border-white/5 gap-4 shadow-xl">
          <div className="px-4 py-2 border-r border-white/5">
            <label className="text-[8px] font-black text-gray-600 uppercase block mb-1">Filtro Inicio</label>
            <input type="date" value={range.start} onChange={(e) => setRange({...range, start: e.target.value})} className="bg-transparent text-xs font-black outline-none text-white cursor-pointer"/>
          </div>
          <div className="px-4 py-2">
            <label className="text-[8px] font-black text-gray-600 uppercase block mb-1">Filtro Fin</label>
            <input type="date" value={range.end} onChange={(e) => setRange({...range, end: e.target.value})} className="bg-transparent text-xs font-black outline-none text-white cursor-pointer"/>
          </div>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] shadow-sm">
          <div className="flex items-center gap-3 text-gray-500 mb-4 uppercase font-black text-[9px] tracking-widest">
            <ShoppingBag size={14}/> Ventas Brutas
          </div>
          <p className="text-3xl font-black">{formatCurrency(stats.ventasTotales)}</p>
          <p className="text-[9px] text-green-500 font-bold mt-2 uppercase">{stats.count} Transacciones</p>
        </div>

        <div className="bg-[#0A0A0A] border border-red-500/20 p-8 rounded-[40px] shadow-sm">
          <div className="flex items-center gap-3 text-red-500 mb-4 uppercase font-black text-[9px] tracking-widest">
            <Trash2 size={14}/> Merma
          </div>
          <p className="text-3xl font-black text-red-500">-{formatCurrency(stats.perdidaMerma)}</p>
          <p className="text-[9px] text-gray-600 font-bold mt-2 uppercase">Pérdida Auditada</p>
        </div>

        <div className="bg-white text-black p-8 rounded-[40px] md:col-span-2 shadow-2xl flex flex-col justify-center">
          <div className="flex items-center gap-3 text-black/40 mb-2 uppercase font-black text-[9px] tracking-widest">
            <Zap size={14}/> Utilidad Neta en Periodo
          </div>
          <p className="text-5xl font-black italic tracking-tighter">{formatCurrency(stats.ventasTotales - stats.perdidaMerma)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* DESGLOSE POR MÉTODO */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] p-10 h-fit">
          <h3 className="text-xl font-black uppercase italic mb-8">Flujo por <span className="text-blue-500">Método</span></h3>
          <div className="space-y-4">
            {[
              { label: 'Efectivo', val: stats.porMetodo['Efectivo'] || 0, icon: <DollarSign className="text-green-500" /> },
              { label: 'Tarjeta / Terminal', val: (stats.porMetodo['Terminal'] || 0) + (stats.porMetodo['Tarjeta'] || 0), icon: <CreditCard className="text-blue-500" /> },
              { label: 'Transferencia', val: stats.porMetodo['Transferencia'] || 0, icon: <Smartphone className="text-purple-500" /> },
              { label: 'A Cuenta (Crédito)', val: stats.porMetodo['A Cuenta'] || 0, icon: <BookOpen className="text-orange-500" /> }
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center p-5 bg-white/[0.02] border border-white/5 rounded-3xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-black rounded-xl border border-white/5">{m.icon}</div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{m.label}</span>
                </div>
                <p className="text-lg font-black">{formatCurrency(m.val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LISTADO DE TRANSACCIONES CON DETALLE */}
        <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/5 rounded-[50px] p-10">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black uppercase italic">Historial <span className="text-gray-500">Detallado</span></h3>
            <div className="bg-white/5 px-4 py-2 rounded-xl text-[9px] font-black text-gray-500 uppercase tracking-widest">
              Mostrando {pedidos.length} registros
            </div>
          </div>

          <div className="space-y-6 max-h-[800px] overflow-y-auto no-scrollbar pr-2">
            {pedidos.map(o => (
              <div key={o.id} className="bg-white/[0.01] border border-white/5 rounded-[40px] p-8 hover:border-green-500/20 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-6">
                    <div className="bg-black p-4 rounded-3xl border border-white/5 text-center min-w-[70px]">
                      <p className="text-[10px] font-black text-gray-600 uppercase mb-1">{format(new Date(o.created_at), 'MMM')}</p>
                      <p className="text-2xl font-black text-white">{format(new Date(o.created_at), 'dd')}</p>
                    </div>
                    <div>
                      <h4 className="text-lg font-black uppercase italic text-white group-hover:text-green-500 transition-colors leading-none">{o.nombre_cliente}</h4>
                      <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-2">
                        {o.metodo_pago} • {format(new Date(o.created_at), 'HH:mm')} hrs
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white">{formatCurrency(o.total)}</p>
                    <span className={`text-[7px] font-black px-2 py-1 rounded-full uppercase ${o.estado === 'Finalizado' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {o.estado}
                    </span>
                  </div>
                </div>

                {/* ✅ DESGLOSE DE ARTÍCULOS EN AUDITORÍA */}
                <div className="flex flex-wrap gap-2 pt-6 border-t border-white/5">
                  {Array.isArray(o.detalle_pedido) && o.detalle_pedido.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-2 rounded-xl">
                      <Package size={10} className="text-gray-600" />
                      <span className="text-[8px] font-black uppercase text-gray-400">
                        {item.quantity}{item.unidad || 'kg'} <span className="text-white">{item.nombre}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
