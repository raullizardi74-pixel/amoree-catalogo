import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  TrendingUp, DollarSign, Trash2, ArrowLeft, Calendar, AlertCircle, ShoppingBag, PieChart, Zap
} from 'lucide-react';

export default function ReporteExito({ onBack }: { onBack: () => void }) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mermas, setMermas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: dataPedidos } = await supabase.from('pedidos').select('*').eq('estado', 'Finalizado').gte('created_at', hace24Horas);
      const { data: dataMermas } = await supabase.from('merma').select('*').gte('created_at', hace24Horas);
      const { data: dataProds } = await supabase.from('productos').select('id, sku, costo');
      if (dataPedidos) setPedidos(dataPedidos);
      if (dataMermas) setMermas(dataMermas);
      if (dataProds) setProductos(dataProds);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const ventasTotales = pedidos.reduce((acc, p) => acc + (p.total || 0), 0);
    const perdidaPorMerma = mermas.reduce((acc, m) => acc + (m.total_perdida || 0), 0);
    let costoTotalVendido = 0;
    pedidos.forEach(p => {
      const detalles = Array.isArray(p.detalle_pedido) ? p.detalle_pedido : [];
      detalles.forEach((item: any) => {
        const prod = productos.find(x => x.id === item.id || x.sku === item.sku);
        costoTotalVendido += ((prod?.costo || 0) * (item.quantity || 0));
      });
    });
    const utilidadNeta = (ventasTotales - costoTotalVendido) - perdidaPorMerma;
    return { ventasTotales, perdidaPorMerma, costoTotalVendido, utilidadNeta, topMermas: mermas.slice(0, 5), conteoPedidos: pedidos.length };
  }, [pedidos, mermas, productos]);

  if (loading) return <div className="py-20 text-center"><Zap className="text-green-500 animate-pulse mx-auto" size={48} /></div>;

  return (
    <div className="bg-black text-white p-4 lg:p-10 min-h-screen">
      <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl"><ArrowLeft size={24} /></button>
          <h2 className="text-4xl font-black uppercase italic tracking-tighter">Auditoría de <span className="text-green-500">Éxito</span></h2>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px]">
          <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Ingresos Totales</p>
          <h3 className="text-3xl font-black">{formatCurrency(stats.ventasTotales)}</h3>
        </div>
        <div className="bg-white text-black p-8 rounded-[40px]">
          <p className="text-[10px] font-black opacity-50 uppercase mb-2">Ganancia Neta</p>
          <h3 className="text-4xl font-black italic tracking-tighter">{formatCurrency(stats.utilidadNeta)}</h3>
        </div>
      </div>
    </div>
  );
}
