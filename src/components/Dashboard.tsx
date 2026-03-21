import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { BarChart3, ShoppingCart, TrendingUp, Package, Calendar, ChevronRight, ArrowLeft, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'compras' | 'rentabilidad'>('compras');
  const [comprasPorProveedor, setComprasPorProveedor] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [detalleCompra, setDetalleCompra] = useState<any[]>([]);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    // Traemos los proveedores y sumamos sus compras
    const { data: proveedores } = await supabase.from('proveedores').select('id, nombre');
    const { data: compras } = await supabase.from('compras').select('*');

    if (proveedores && compras) {
      const resumen = proveedores.map(prov => {
        const total = compras
          .filter(c => c.proveedor_id === prov.id)
          .reduce((acc, curr) => acc + Number(curr.total), 0);
        const numNotas = compras.filter(c => c.proveedor_id === prov.id).length;
        return { ...prov, total, numNotas };
      }).filter(p => p.total > 0);
      
      setComprasPorProveedor(resumen);
    }
    setLoading(false);
  };

  const verDetalleProveedor = async (provider: any) => {
    setLoading(true);
    setSelectedProvider(provider);
    const { data } = await supabase
      .from('compras')
      .select(`
        id, created_at, folio, total,
        compras_detalle (*)
      `)
      .eq('proveedor_id', provider.id)
      .order('created_at', { ascending: false });
    
    if (data) setDetalleCompra(data);
    setLoading(false);
  };

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
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <Calendar className="text-gray-400" size={20}/>
                  </div>
                  <div>
                    <p className="text-white font-black text-sm uppercase italic">
                      {format(new Date(compra.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    <p className="text-[9px] text-green-500 font-black tracking-widest flex items-center gap-1 uppercase mt-1">
                      <Hash size={10}/> Folio: {compra.folio}
                    </p>
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
          <p className="text-[9px] text-gray-500 font-black tracking-[0.4em] uppercase mt-2">Auditoría en Tiempo Real</p>
        </div>
        <div className="flex bg-black p-2 rounded-3xl border border-white/5 gap-2">
           <button onClick={() => setTab('compras')} className={px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'compras' ? 'bg-white text-black' : 'text-gray-500'}}>🛒 Compras</button>
           <button onClick={() => setTab('rentabilidad')} className={px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${tab === 'rentabilidad' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-gray-500'}}>📈 Utilidad</button>
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
              <button 
                key={prov.id}
                onClick={() => verDetalleProveedor(prov)}
                className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[40px] flex items-center justify-between group hover:border-green-500/30 transition-all text-left"
              >
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
        <div className="bg-[#0A0A0A] border border-white/5 p-20 rounded-[50px] text-center">
           <TrendingUp className="mx-auto text-gray-800 mb-6" size={48}/>
           <p className="text-xl font-black uppercase italic tracking-widest text-gray-600">Módulo de Rentabilidad en Proceso...</p>
        </div>
      )}
    </div>
  );
}
