import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Truck, Camera, Save, ArrowLeft, Package, Hash } from 'lucide-react';

export default function ReciboModule({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'provider' | 'receipt'>('provider');
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [cambios, setCambios] = useState<Record<number, { cantidad: string, nuevoCosto: string }>>({});
  const [showScanner, setShowScanner] = useState(false);
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
    if (Object.keys(cambios).length === 0) return alert("No hay cambios que guardar.");
    if (!folio.trim()) return alert("⚠️ El Folio/Remisión es obligatorio.");

    setLoading(true);
    try {
      let totalCompra = 0;
      const detallesParaInsertar = [];

      for (const id in cambios) {
        const item = cambios[id];
        const prodOriginal = productosProveedor.find(p => p.id === parseInt(id));
        
        if (item.cantidad && item.cantidad !== '') {
          const cantidadRecibida = parseFloat(item.cantidad);
          const costoNuevo = item.nuevoCosto ? parseFloat(item.nuevoCosto) : (prodOriginal.costo || 0);
          const subtotal = cantidadRecibida * costoNuevo;
          
          totalCompra += subtotal;
          
          // ✅ PUNTO 5: LÓGICA DE COSTO PROMEDIO PONDERADO
          const stockActualVal = Math.max(0, prodOriginal.stock_actual || 0);
          const costoAnterior = prodOriginal.costo || 0;
          const stockTotal = stockActualVal + cantidadRecibida;
          
          const costoPromedio = ((stockActualVal * costoAnterior) + (cantidadRecibida * costoNuevo)) / stockTotal;

          detallesParaInsertar.push({
            producto_id: prodOriginal.id,
            sku: prodOriginal.sku,
            nombre: prodOriginal.nombre,
            cantidad: cantidadRecibida,
            costo_unitario: costoNuevo,
            costo_promedio_calculado: Number(costoPromedio.toFixed(2)),
            nuevo_stock: stockTotal,
            subtotal: subtotal
          });
        }
      }

      const { data: compra, error: errorCompra } = await supabase
        .from('compras')
        .insert([{ 
          proveedor_id: selectedProvider.id, 
          folio: folio.toUpperCase(), 
          total: totalCompra,
          metodo_pago: 'Efectivo'
        }])
        .select().single();

      if (errorCompra) throw errorCompra;

      for (const d of detallesParaInsertar) {
        await supabase.from('compras_detalle').insert([{
          compra_id: compra.id,
          nombre: d.nombre,
          cantidad: d.cantidad,
          costo_unitario: d.costo_unitario,
          subtotal: d.subtotal
        }]);

        await supabase.from('productos').update({ 
          stock_actual: d.nuevo_stock,
          costo: d.costo_promedio_calculado 
        }).eq('id', d.producto_id);
      }

      alert(`✅ Compra ${folio} registrada. Costos promediados con éxito.`);
      onBack();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally { setLoading(false); }
  };

  if (step === 'provider') {
    return (
      <div className="p-6 animate-in fade-in duration-500">
        <button onClick={onBack} className="mb-8 text-gray-500 hover:text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"><ArrowLeft size={16}/> Regresar</button>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-10">Seleccionar <span className="text-green-500">Proveedor</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proveedores.map(p => (
            <button key={p.id} onClick={() => startReceipt(p)} className="bg-[#0A0A0A] border border-white/5 p-8 rounded-[35px] text-left hover:border-green-500/50 transition-all group flex items-center justify-between">
              <div>
                <Truck className="text-gray-700 group-hover:text-green-500 mb-2" size={24}/>
                <p className="text-xl font-black uppercase italic tracking-tight">{p.nombre}</p>
              </div>
              <Package className="text-gray-600" size={20}/>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 animate-in slide-in-from-right duration-500">
      <div className="sticky top-20 bg-black/90 backdrop-blur-xl z-[60] p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div>
            <h2 className="text-2xl font-black uppercase italic leading-none">{selectedProvider.nombre}</h2>
            <p className="text-[9px] text-green-500 font-black tracking-[0.3em] uppercase mt-1">Costo Promedio Activo</p>
          </div>
          <div className="flex-1 md:w-48 bg-white/5 p-3 rounded-2xl border border-white/10">
            <input type="text" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="FOLIO / NOTA" className="bg-transparent text-white font-black outline-none w-full text-xs" />
          </div>
        </div>
        <button onClick={saveReceipt} disabled={loading} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">
          {loading ? 'Sincronizando...' : 'Finalizar Recibo'}
        </button>
      </div>

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        {productosProveedor.map(p => (
          <div key={p.id} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[40px]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <h4 className="text-[11px] font-black uppercase text-white">{p.nombre}</h4>
                <p className="text-[9px] text-gray-600 font-bold uppercase">Stock: {p.stock_actual} {p.unidad}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                  <label className="text-[7px] text-gray-500 uppercase block mb-1">Costo Act: {formatCurrency(p.costo)}</label>
                  <input type="number" placeholder="Nuevo $" className="w-full bg-transparent text-sm font-black text-white outline-none" onChange={(e) => handleInputChange(p.id, 'nuevoCosto', e.target.value)} />
                </div>
                <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
                  <label className="text-[7px] text-green-500/50 uppercase block mb-1">Cantidad</label>
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
