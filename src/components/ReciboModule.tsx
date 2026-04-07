import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Truck, ArrowLeft, Package, TrendingUp, AlertCircle, CheckCircle2, Zap, ChevronRight, ClipboardList } from 'lucide-react';

export default function ReciboModule({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'provider' | 'receipt'>('provider');
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [misionesGlobales, setMisionesGlobales] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [ordenPlaneada, setOrdenPlaneada] = useState<any>(null);
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [cambios, setCambios] = useState<Record<number, { cantidad: string, nuevoCosto: string, nuevoPrecio: string }>>({});
  const [folio, setFolio] = useState('');

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: provs } = await supabase.from('proveedores').select('*').order('nombre');
      const { data: misiones } = await supabase.from('ordenes_abasto').select('*').eq('estado', 'Pendiente');
      if (provs) setProveedores(provs);
      if (misiones) setMisionesGlobales(misiones);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startReceipt = async (provider: any) => {
    setLoading(true);
    setSelectedProvider(provider);
    try {
      const { data: prods } = await supabase.from('productos').select('*').eq('proveedor_id', provider.id).order('nombre');
      // ✅ CORRECCIÓN DE COMPARACIÓN: Forzamos a String para evitar fallos de tipo
      const mision = misionesGlobales.find(m => String(m.proveedor_id) === String(provider.id));
      if (prods) setProductosProveedor(prods);
      if (mision) {
        setOrdenPlaneada(mision);
        const preCarga: Record<number, any> = {};
        mision.items.forEach((item: any) => {
          const pLocal = prods?.find(p => p.sku === item.sku);
          if (pLocal) {
            preCarga[pLocal.id] = {
              cantidad: item.cantidad_sugerida.toString(),
              nuevoCosto: item.costo_base.toString(),
              nuevoPrecio: pLocal.precio_venta.toString()
            };
          }
        });
        setCambios(preCarga);
      } else {
        setOrdenPlaneada(null);
        setCambios({});
      }
      setStep('receipt');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleInputChange = (id: number, field: 'cantidad' | 'nuevoCosto' | 'nuevoPrecio', value: string) => {
    setCambios(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const saveReceipt = async () => {
    if (Object.keys(cambios).length === 0) return alert("No hay cambios.");
    if (!folio.trim()) return alert("⚠️ Folio obligatorio.");
    setLoading(true);
    try {
      let totalAcumulado = 0;
      const detallesParaInsertar = [];
      for (const id in cambios) {
        const item = cambios[id];
        const prodOriginal = productosProveedor.find(p => p.id === parseInt(id));
        if (item.cantidad && item.cantidad !== '' && prodOriginal) {
          const cant = parseFloat(item.cantidad);
          const costoN = item.nuevoCosto ? parseFloat(item.nuevoCosto) : (prodOriginal.costo || 0);
          const precioN = item.nuevoPrecio ? parseFloat(item.nuevoPrecio) : (prodOriginal.precio_venta || 0);
          const sub = cant * costoN;
          totalAcumulado += sub;
          const stockAct = Math.max(0, prodOriginal.stock_actual || 0);
          const stockTot = Number((stockAct + cant).toFixed(3));
          const costoProm = stockTot > 0 ? ((stockAct * (prodOriginal.costo || 0)) + (cant * costoN)) / stockTot : costoN;
          detallesParaInsertar.push({
            producto_id: prodOriginal.id, sku: prodOriginal.sku, nombre: prodOriginal.nombre,
            unidad: prodOriginal.unidad, cantidad: cant, costo_unitario: costoN,
            precio_venta: precioN, costo_promedio: Number(costoProm.toFixed(2)),
            nuevo_stock: stockTot, subtotal: sub
          });
        }
      }
      const pArt = detallesParaInsertar[0];
      const { data: compra, error: errorC } = await supabase.from('compras').insert([{ 
        proveedor_id: selectedProvider.id, proveedor: selectedProvider.nombre, folio: folio.toUpperCase(),
        total: totalAcumulado, total_compra: totalAcumulado, metodo_pago: 'Efectivo',
        producto_sku: pArt.sku, nombre_producto: pArt.nombre, unidad: pArt.unidad,
        costo_unitario: pArt.costo_unitario, precio_venta_nuevo: pArt.precio_venta
      }]).select().single();
      if (errorC) throw errorC;
      for (const d of detallesParaInsertar) {
        await supabase.from('compras_detalle').insert([{
          compra_id: compra.id, producto_id: d.producto_id, sku: d.sku, nombre: d.nombre,
          cantidad: d.cantidad, costo_unitario: d.costo_unitario, subtotal: d.subtotal
        }]);
        await supabase.from('productos').update({ stock_actual: d.nuevo_stock, costo: d.costo_promedio, precio_venta: d.precio_venta }).eq('id', d.producto_id);
      }
      if (ordenPlaneada) {
        await supabase.from('ordenes_abasto').update({ estado: 'Completado', compra_id: compra.id }).eq('id', ordenPlaneada.id);
      }
      alert("✅ Sincronización Exitosa.");
      onBack();
    } catch (e: any) { alert("Error: " + e.message); } finally { setLoading(false); }
  };

  if (step === 'provider') {
    return (
      <div className="p-6 animate-in fade-in duration-500">
        <button onClick={onBack} className="mb-8 text-gray-500 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"><ArrowLeft size={16}/> Regresar</button>
        <h2 className="text-3xl font-black italic uppercase mb-10 tracking-tighter">Surtir <span className="text-green-500">Local</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proveedores.map(p => {
            const tieneMision = misionesGlobales.some(m => String(m.proveedor_id) === String(p.id));
            return (
              <button key={p.id} onClick={() => startReceipt(p)} className={`bg-[#0A0A0A] border p-8 rounded-[35px] text-left transition-all flex justify-between items-center group relative overflow-hidden ${tieneMision ? 'border-blue-500/50 shadow-2xl' : 'border-white/5'}`}>
                {tieneMision && <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase flex items-center gap-1"><Zap size={10} fill="currentColor"/> Misión</div>}
                <div><Truck className={tieneMision ? 'text-blue-500' : 'text-gray-700'} size={24}/><p className="text-xl font-black uppercase italic">{p.nombre}</p></div>
                <ChevronRight className="text-gray-700 group-hover:translate-x-2 transition-transform" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#050505] text-white">
      <div className="sticky top-0 bg-black/90 backdrop-blur-xl z-[60] p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto"><button onClick={() => setStep('provider')} className="bg-white/5 p-3 rounded-xl"><ArrowLeft size={16}/></button><div><h2 className="text-2xl font-black uppercase italic leading-none">{selectedProvider.nombre}</h2><p className="text-[9px] text-green-500 font-black uppercase mt-1 tracking-widest">{ordenPlaneada ? 'Misión Activa' : 'Recibo Libre'}</p></div><input type="text" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="FOLIO" className="flex-1 md:w-48 bg-white/5 p-3 rounded-2xl border border-white/10 text-white font-black outline-none text-xs uppercase" /></div>
        <button onClick={saveReceipt} disabled={loading} className="w-full md:w-auto bg-green-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">{loading ? '...' : 'Cargar Inventario'}</button>
      </div>

      {ordenPlaneada && (
        <div className="mx-6 mt-6 p-5 bg-blue-600/10 border border-blue-500/20 rounded-[2.5rem] flex items-center justify-between">
           <div className="flex items-center gap-4"><div className="bg-blue-600 p-3 rounded-2xl text-white"><ClipboardList size={20}/></div><div><p className="text-xs font-black uppercase text-white">Sugerencia de {selectedProvider.nombre}</p><p className="text-[9px] font-bold text-blue-400 uppercase">Pre-cargamos lo planeado en Almacén.</p></div></div>
           <p className="text-xl font-black text-white italic">{formatCurrency(ordenPlaneada.total_planeado)}</p>
        </div>
      )}

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        {productosProveedor.map(p => {
          const itemCambio = cambios[p.id] || { cantidad: '', nuevoCosto: '', nuevoPrecio: '' };
          const planeado = ordenPlaneada?.items.find((i: any) => i.sku === p.sku);
          return (
            <div key={p.id} className={`bg-[#0A0A0A] border p-6 rounded-[40px] ${planeado ? 'border-blue-500/20 bg-blue-500/[0.02]' : 'border-white/5'}`}>
               <div className="flex justify-between items-start mb-4"><div><h4 className="text-[11px] font-black uppercase text-white">{p.nombre}</h4><p className="text-[9px] text-gray-600 font-bold uppercase mt-1">STOCK: {Number(p.stock_actual.toFixed(3))} {p.unidad}</p>{planeado && <span className="text-[7px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase mt-2 inline-block">PEDIR: {planeado.cantidad_sugerida}</span>}</div><p className="text-[10px] font-black text-green-500 uppercase italic">Ant: {formatCurrency(p.costo)}</p></div>
               <div className="grid grid-cols-3 gap-3">
                  <div className="bg-black p-4 rounded-2xl border border-white/5 shadow-inner"><label className="text-[7px] text-gray-500 uppercase block mb-1">Llegó</label><input type="number" value={itemCambio.cantidad} placeholder="0.0" className="w-full bg-transparent text-xl font-black text-green-500 outline-none" onChange={(e) => handleInputChange(p.id, 'cantidad', e.target.value)} /></div>
                  <div className="bg-black p-4 rounded-2xl border border-white/5 shadow-inner"><label className="text-[7px] text-gray-500 uppercase block mb-1">Costo</label><input type="number" value={itemCambio.nuevoCosto} placeholder={p.costo?.toString()} className="w-full bg-transparent text-sm font-black text-white outline-none" onChange={(e) => handleInputChange(p.id, 'nuevoCosto', e.target.value)} /></div>
                  <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 shadow-inner"><label className="text-[7px] text-blue-500 uppercase block mb-1">Venta</label><input type="number" value={itemCambio.nuevoPrecio} placeholder={p.precio_venta?.toString()} className="w-full bg-transparent text-sm font-black text-blue-400 outline-none" onChange={(e) => handleInputChange(p.id, 'nuevoPrecio', e.target.value)} /></div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
