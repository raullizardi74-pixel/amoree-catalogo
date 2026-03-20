import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Truck, Camera, Save, ArrowLeft, AlertCircle, Package, Search, Hash } from 'lucide-react';

export default function ReciboModule({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'provider' | 'receipt'>('provider');
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [productosProveedor, setProductosProveedor] = useState<any[]>([]);
  const [cambios, setCambios] = useState<Record<number, { cantidad: string, nuevoCosto: string }>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // ✅ ESTADO PARA EL FOLIO
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

  const handleScanSuccess = (sku: string) => {
    const index = productosProveedor.findIndex(p => p.sku === sku);
    if (index !== -1) {
      const element = document.getElementById(`prod-${productosProveedor[index].id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.classList.add('ring-2', 'ring-green-500');
      setTimeout(() => element?.classList.remove('ring-2', 'ring-green-500'), 3000);
    } else {
      alert("Este producto no pertenece a este proveedor o no está registrado.");
    }
    setShowScanner(false);
  };

  // ✅ LÓGICA DE GUARDADO TITANIUM (AFECTA INVENTARIO Y CREA AUDITORÍA)
  const saveReceipt = async () => {
    if (Object.keys(cambios).length === 0) return alert("No hay cambios que guardar.");
    if (!folio.trim()) return alert("⚠️ El Folio/Remisión es obligatorio para el registro de compra.");

    setLoading(true);
    try {
      let totalCompra = 0;
      const detallesParaInsertar = [];

      // 1. Calculamos el total y preparamos los datos del detalle
      for (const id in cambios) {
        const item = cambios[id];
        const prodOriginal = productosProveedor.find(p => p.id === parseInt(id));
        
        if (item.cantidad && item.cantidad !== '') {
          const cantidadRecibida = parseFloat(item.cantidad);
          const costoUnitario = item.nuevoCosto ? parseFloat(item.nuevoCosto) : prodOriginal.costo;
          const subtotal = cantidadRecibida * costoUnitario;
          
          totalCompra += subtotal;
          
          detallesParaInsertar.push({
            producto_id: prodOriginal.id,
            sku: prodOriginal.sku,
            nombre: prodOriginal.nombre,
            cantidad: cantidadRecibida,
            costo_unitario: costoUnitario,
            subtotal: subtotal
          });
        }
      }

      // 2. Insertamos la cabecera de la compra
      const { data: compra, error: errorCompra } = await supabase
        .from('compras')
        .insert([{ 
          proveedor_id: selectedProvider.id, 
          folio: folio.toUpperCase(), 
          total: totalCompra,
          metodo_pago: 'Efectivo' // Como nos dijiste, se pagan al momento
        }])
        .select()
        .single();

      if (errorCompra) throw errorCompra;

      // 3. Insertamos el detalle y actualizamos el stock/costo de cada producto
      for (const detalle of detallesParaInsertar) {
        // Insertar en compras_detalle
        await supabase.from('compras_detalle').insert([{
          compra_id: compra.id,
          ...detalle
        }]);

        // Actualizar tabla productos (Sincronización total)
        const prodOriginal = productosProveedor.find(p => p.id === detalle.producto_id);
        const nuevoStock = (prodOriginal.stock_actual || 0) + detalle.cantidad;
        
        await supabase.from('productos').update({ 
          stock_actual: nuevoStock,
          costo: detalle.costo_unitario 
        }).eq('id', detalle.producto_id);
      }

      alert(`✅ Compra ${folio} registrada. Total: ${formatCurrency(totalCompra)}`);
      onBack();
    } catch (e: any) {
      console.error(e);
      alert("Error al procesar el recibo: " + e.message);
    }
    setLoading(false);
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
              <div className="bg-white/5 p-4 rounded-2xl group-hover:bg-green-500/10 transition-colors">
                <Package className="text-gray-600 group-hover:text-green-500" size={20}/>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 animate-in slide-in-from-right duration-500">
      {/* HEADER DINÁMICO CON CAMPO DE FOLIO */}
      <div className="sticky top-20 bg-black/90 backdrop-blur-xl z-[60] p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div>
            <h2 className="text-2xl font-black uppercase italic leading-none">{selectedProvider.nombre}</h2>
            <p className="text-[9px] text-green-500 font-black tracking-[0.3em] uppercase mt-1">Recibo de Mercancía</p>
          </div>
          <div className="flex-1 md:w-48 bg-white/5 p-3 rounded-2xl border border-white/10">
            <label className="text-[8px] font-black text-gray-500 uppercase block mb-1 flex items-center gap-1"><Hash size={10}/> Folio de Nota</label>
            <input 
              type="text" 
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              placeholder="Escribe el Folio..."
              className="bg-transparent text-white font-black outline-none w-full text-xs placeholder:text-gray-700"
            />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={() => setShowScanner(true)} className="flex-1 md:flex-none bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase"><Camera size={18}/> Escanear</button>
          <button 
            onClick={saveReceipt} 
            disabled={loading} 
            className="flex-1 md:flex-none bg-green-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-green-900/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Finalizar Recibo'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        {productosProveedor.map(p => (
          <div key={p.id} id={`prod-${p.id}`} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[40px] transition-all duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-[20px] bg-black border border-white/5 overflow-hidden flex-shrink-0">
                  <img src={p.url_imagen} className="w-full h-full object-cover opacity-60" alt={p.nombre} />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase leading-tight text-white">{p.nombre}</h4>
                  <p className="text-[9px] text-gray-600 font-bold mt-1 uppercase">SKU: {p.sku}</p>
                  <p className="text-[10px] text-green-500/80 font-black mt-1">Stock Actual: {p.stock_actual} {p.unidad}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/50 p-4 rounded-2xl border border-white/5">
                  <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">Costo Anterior: {formatCurrency(p.costo)}</label>
                  <input 
                    type="number" 
                    placeholder="Nuevo Costo"
                    className={`w-full bg-transparent text-sm font-black outline-none transition-colors ${cambios[p.id]?.nuevoCosto && parseFloat(cambios[p.id]?.nuevoCosto) > p.costo ? 'text-red-500' : 'text-white'}`}
                    onChange={(e) => handleInputChange(p.id, 'nuevoCosto', e.target.value)}
                  />
                </div>
                <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/10">
                  <label className="text-[8px] font-black text-green-500/50 uppercase block mb-1">Cant. Recibida</label>
                  <input 
                    type="number" 
                    placeholder="+ 0"
                    className="w-full bg-transparent text-xl font-black text-green-500 outline-none"
                    onChange={(e) => handleInputChange(p.id, 'cantidad', e.target.value)}
                  />
                </div>
              </div>

              <div className="text-right hidden md:block">
                {cambios[p.id]?.cantidad && (
                  <div className="animate-in fade-in slide-in-from-right duration-300">
                    <p className="text-[8px] font-black text-gray-600 uppercase">Nueva Existencia</p>
                    <p className="text-xl font-black text-white">{(p.stock_actual + parseFloat(cambios[p.id].cantidad)).toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
