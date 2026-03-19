import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Camera, Save, ArrowLeft, Package, Truck, DollarSign, BarChart3, UploadCloud, QrCode } from 'lucide-react';

export default function InventoryModule({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    id: null as number | null,
    sku: '',
    nombre: '',
    categoria: 'Abarrotes',
    costo: '', // Ajustado a tu CSV
    precio_venta: '',
    stock_actual: '',
    proveedor_id: '',
    url_imagen: '' // Ajustado a tu CSV
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre');
    if (data) setProveedores(data);
  };

  const handleScanSuccess = async (sku: string) => {
    setLoading(true);
    const { data } = await supabase.from('productos').select('*').eq('sku', sku).single();
    
    if (data) {
      setFormData({
        id: data.id,
        sku: data.sku,
        nombre: data.nombre,
        categoria: data.categoria || 'Abarrotes',
        costo: data.costo?.toString() || '', // Ahora lee la columna correcta
        precio_venta: data.precio_venta?.toString() || '',
        stock_actual: data.stock_actual?.toString() || '',
        proveedor_id: data.proveedor_id?.toString() || '',
        url_imagen: data.url_imagen || '' // Ahora lee la columna correcta
      });
    } else {
      setFormData({ ...formData, sku, id: null, nombre: '', costo: '', precio_venta: '', stock_actual: '', url_imagen: '' });
    }
    setShowScanner(false);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !formData.sku) return alert("Primero escanea o ingresa un SKU");

    setLoading(true);
    const fileName = `${formData.sku}_${Date.now()}.webp`;
    const { data, error } = await supabase.storage.from('productos').upload(fileName, file);

    if (error) {
      alert("Error subiendo imagen: " + error.message);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, url_imagen: publicUrl }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.sku) return alert("Nombre y SKU obligatorios");
    setLoading(true);

    const payload = {
      nombre: formData.nombre.toUpperCase(),
      sku: formData.sku,
      categoria: formData.categoria,
      costo: parseFloat(formData.costo) || 0, // Guarda en tu columna 'costo'
      precio_venta: parseFloat(formData.precio_venta) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
      url_imagen: formData.url_imagen, // Guarda en tu columna 'url_imagen'
      activo: true
    };

    const { error } = formData.id 
      ? await supabase.from('productos').update(payload).eq('id', formData.id)
      : await supabase.from('productos').insert([payload]);

    if (!error) {
      alert("¡Producto guardado exitosamente! 🚀");
      onBack();
    } else {
      alert("Error al guardar: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12 bg-black p-6 rounded-3xl border border-white/5 sticky top-20 z-50 backdrop-blur-xl">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl text-gray-500 hover:text-white"><ArrowLeft size={20}/></button>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">Inventario <span className="text-green-500">Amoree</span></h2>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg active:scale-95"><Camera size={20}/></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          <div className="space-y-8">
            {/* CARGA DE FOTO */}
            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
              <label className="text-[9px] font-black text-gray-500 uppercase mb-4 block">Imagen (Tocar para cambiar)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video bg-black border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
              >
                {formData.url_imagen ? (
                  <img src={formData.url_imagen} className="w-full h-full object-cover" alt="Producto" />
                ) : (
                  <div className="text-center">
                    <UploadCloud size={40} className="text-gray-700 mb-3 mx-auto" />
                    <p className="text-[10px] font-black uppercase text-gray-600">Tomar Foto</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
              </div>
            </div>

            {/* SKU Y NOMBRE */}
            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 space-y-6">
               <div>
                 <label className="text-[9px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2"><QrCode size={12}/> SKU</label>
                 <input type="text" value={formData.sku} readOnly className="w-full bg-transparent py-2 text-xl font-black text-green-500 outline-none" />
               </div>
               <div>
                 <label className="text-[9px] font-black text-gray-500 uppercase mb-2 block">Nombre</label>
                 <input type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-transparent py-2 text-2xl font-black uppercase italic outline-none focus:border-green-500" placeholder="NOMBRE DEL PRODUCTO" />
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#0A0A0A] p-6 rounded-[30px] border border-white/5">
                 <label className="text-[9px] font-black text-gray-400 uppercase mb-3 block flex items-center gap-2"><Truck size={12}/> Proveedor</label>
                 <select value={formData.proveedor_id} onChange={e => setFormData({...formData, proveedor_id: e.target.value})} className="w-full bg-transparent text-[11px] font-black uppercase outline-none">
                   <option value="" className="bg-black">Seleccionar...</option>
                   {proveedores.map(p => <option key={p.id} value={p.id} className="bg-black">{p.nombre}</option>)}
                 </select>
               </div>
               <div className="bg-[#0A0A0A] p-6 rounded-[30px] border border-white/5">
                 <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block flex items-center gap-2"><Package size={12}/> Existencia</label>
                 <input type="number" value={formData.stock_actual} onChange={e => setFormData({...formData, stock_actual: e.target.value})} className="w-full bg-transparent text-3xl font-black outline-none" />
               </div>
            </div>

            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 space-y-8">
               <div className="flex justify-between items-center">
                 <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2"><DollarSign size={14}/> Precio Costo</label>
                 <input type="number" value={formData.costo} onChange={e => setFormData({...formData, costo: e.target.value})} className="bg-transparent text-right text-2xl font-black outline-none w-32" placeholder="0.00" />
               </div>
               <div className="flex justify-between items-center bg-green-900/10 p-4 rounded-2xl">
                 <label className="text-[10px] font-black text-green-500 uppercase flex items-center gap-2"><BarChart3 size={14}/> Precio Venta</label>
                 <input type="number" value={formData.precio_venta} onChange={e => setFormData({...formData, precio_venta: e.target.value})} className="bg-transparent text-right text-4xl font-black text-green-500 outline-none w-40" placeholder="0.00" />
               </div>
            </div>

            <button onClick={handleSave} disabled={loading} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
              <Save size={18}/> {formData.id ? 'Actualizar Producto' : 'Registrar Producto'}
            </button>
          </div>
        </div>
      </div>
      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
