import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Truck, ArrowLeft, Package } from 'lucide-react';

export default function ReciboModule({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'provider' | 'receipt'>('provider');
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [cambios, setCambios] = useState<Record<number, { cantidad: string, nuevoCosto: string }>>({});
  const [folio, setFolio] = useState('');

  useEffect(() => { fetchProveedores(); }, []);

  const fetchProveedores = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre');
    if (data) setProveedores(data);
  };

  const startReceipt = async (provider: any) => {
    setLoading(true);
    setSelectedProvider(provider);
    const { data } = await supabase.from('productos').select('*').eq('proveedor_id', provider.id).order('nombre');
    if (data) setProductosProveedor(data);
    setStep('receipt');
    setLoading(false);
  };

  const handleInputChange = (id: number, field: 'cantidad' | 'nuevoCosto', value: string) => {
    setCambios(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const saveReceipt = async () => {
    if (Object.keys(cambios).length === 0) return alert("Socio, no hay cambios que guardar.");
    if (!folio.trim()) return alert("⚠️ El Folio es obligatorio.");

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
          const sub = cant * costoN;
          totalAcumulado += sub;
          
          const stockAct = Math.max(0, prodOriginal.stock_actual || 0);
          const stockTot = stockAct + cant;
          
          // ✅ CORRECCIÓN DEL ERROR: Usamos stockTot (la variable correcta)
          const costoProm = stockTot > 0 
            ? ((stockAct * (prodOriginal.costo || 0)) + (cant * costoN)) / stockTot 
            : costoN;

          detallesParaInsertar.push({
            producto_id: prodOriginal.id,
            sku: prodOriginal.sku,
            nombre: prodOriginal.nombre,
            cantidad: cant,
            costo_unitario: costoN,
            costo_promedio: Number(costoProm.toFixed(2)),
            nuevo_stock: stockTot,
            subtotal: sub
          });
        }
      }

      // ✅ ELIMINAMOS NULLS: Llenamos todas las columnas de dinero y proveedor
      const { data: compra, error: errorC } = await supabase
        .from('compras')
        .insert([{ 
          proveedor_id: selectedProvider.id, 
          proveedor: selectedProvider.nombre,
          folio: folio.toUpperCase(), 
          total: totalAcumulado,
          total_compra: totalAcumulado, // Columna de respaldo para evitar NULL
          metodo_pago: 'Efectivo'
        }])
        .select().single();

      if (errorC) throw errorC;

      for (const d of detallesParaInsertar) {
        // Guardamos el detalle vinculado a la compra
        await supabase.from('compras_detalle').insert([{
          compra_id: compra.id,
          producto_id: d.producto_id,
          sku: d.sku,
          nombre: d.nombre,
          cantidad: d.cantidad,
          costo_unitario: d.costo_unitario,
          subtotal: d.subtotal
        }]);

        // Actualizamos el producto con el nuevo stock y costo promedio
        await supabase.from('productos').update({ 
          stock_actual: d.nuevo_stock,
          costo: d.costo_promedio 
        }).eq('id', d.producto_id);
      }

      alert("✅ Recibo de FEMSA guardado e Inventario actualizado.");
      onBack();
    } catch (e: any) { 
      console.error(e);
      alert("Error al guardar: " + e.message); 
    } finally { setLoading(false); }
  };

  if (step === 'provider') {
    return (
      <div className="p-6 animate-in fade-in duration-500">
        <button onClick={onBack} className="mb-8 text-gray-500 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"><ArrowLeft size={16}/> Regresar</button>
        <h2 className="text-3xl font-black italic uppercase mb-10 tracking-tighter">Surtir <span className="text-green-500">Local</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proveedores.map(p => (
            <button key={p.id} onClick={() => startReceipt(p)} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[35px] text-left hover:border-green-500 transition-all flex justify-between items-center group">
              <div><Truck className="text-gray-700 group-hover:text-green-500 mb-2" size={24}/><p className="text-xl font-black uppercase italic">{p.nombre}</p></div>
              <Package className="text-gray-600" size={20}/>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 animate-in slide-in-from-right duration-500">
      <div className="sticky top-0 bg-black/90 backdrop-blur-xl z-[60] p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={() => setStep('provider')} className="bg-white/5 p-3 rounded-xl hover:bg-white/10"><ArrowLeft size={16}/></button>
          <div>
            <h2 className="text-2xl font-black uppercase italic leading-none">{selectedProvider.nombre}</h2>
            <p className="text-[9px] text-green-500 font-black uppercase mt-1 tracking-widest">Entrada de Mercancía</p>
          </div>
          <input type="text" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="FOLIO / NOTA" className="flex-1 md:w-48 bg-white/5 p-3 rounded-2xl border border-white/10 text-white font-black outline-none text-xs uppercase" />
        </div>
        <button onClick={saveReceipt} disabled={loading} className="w-full md:w-auto bg-green-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg shadow-green-900/20">
          {loading ? 'Guardando...' : 'Finalizar Recibo'}
        </button>
      </div>

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        {productosProveedor.map(p => (
          <div key={p.id} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[40px]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <h4 className="text-[11px] font-black uppercase text-white leading-tight">{p.nombre}</h4>
                <p className="text-[9px] text-gray-600 font-bold uppercase mt-1">Stock Actual: {p.stock_actual} {p.unidad}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 col-span-2">
                <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                  <label className="text-[7px] text-gray-500 uppercase block mb-1">Costo Unitario</label>
                  <input type="number" placeholder={p.costo?.toString() || "0"} className="w-full bg-transparent text-sm font-black text-white outline-none" onChange={(e) => handleInputChange(p.id, 'nuevoCosto', e.target.value)} />
                </div>
                <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
                  <label className="text-[7px] text-green-500/50 uppercase block mb-1">Cantidad a Recibir</label>
                  <input type="number" placeholder="+ 0" className="w-full bg-transparent text-xl font-black text-green-500 outline-none" onChange={(e) => handleInputChange(p.id, 'cantidad', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
