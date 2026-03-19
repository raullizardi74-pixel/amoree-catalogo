import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { Camera, Save, ArrowLeft, Package, Truck, DollarSign, BarChart3, UploadCloud, QrCode, X } from 'lucide-react';

export default function InventoryModule({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [proveedores, setProveedores] = useState<any[]>([]);
  
  // ESTADO DEL PRODUCTO (Datos iniciales vacíos y seguros)
  const [formData, setFormData] = useState({
    id: null as number | null,
    sku: '',
    nombre: '',
    categoria: 'Abarrotes',
    precio_costo: '',
    precio_venta: '',
    stock_actual: '',
    proveedor_id: '',
    imagen_url: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre');
    if (data) setProveedores(data);
  };

  // --- LÓGICA DE ESCANEO INTELIGENTE ---
  const handleScanSuccess = async (sku: string) => {
    setLoading(true);
    // Buscamos si ya existe
    const { data, error } = await supabase.from('productos').select('*').eq('sku', sku).single();
    
    if (data) {
      // SI EXISTE: Cargamos datos para actualizar
      setFormData({
        id: data.id,
        sku: data.sku,
        nombre: data.nombre,
        categoria: data.categoria || 'Abarrotes',
        precio_costo: data.precio_costo?.toString() || '',
        precio_venta: data.precio_venta?.toString() || '',
        stock_actual: data.stock_actual?.toString() || '',
        proveedor_id: data.proveedor_id?.toString() || '',
        imagen_url: data.imagen_url || ''
      });
    } else {
      // SI ES NUEVO: Pre-llenamos SKU y limpiamos el resto
      setFormData({ 
        id: null,
        sku: sku,
        nombre: '',
        categoria: 'Abarrotes',
        precio_costo: '',
        precio_venta: '',
        stock_actual: '',
        proveedor_id: '',
        imagen_url: ''
      });
    }
    setShowScanner(false);
    setLoading(false);
  };

  // --- SUBIDA DE IMAGEN A SUPABASE STORAGE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // VALIDACIÓN CRÍTICA: Necesitamos SKU para nombrar el archivo
    if (!formData.sku) {
      alert("⚠️ ERROR: Primero escanea o ingresa manualmente un SKU para el producto.");
      if(fileInputRef.current) fileInputRef.current.value = ''; // Limpiar input
      return;
    }
    
    if (!file) return;

    setLoading(true);
    // Nombre de archivo único: SKU + Timestamp
    const fileExt = file.name.split('.').pop();
    const fileName = `${formData.sku}_${Date.now()}.${fileExt}`;
    
    // Subimos al bucket 'productos' que creamos
    const { data, error } = await supabase.storage
      .from('productos')
      .upload(fileName, file);

    if (error) {
      alert("Error subiendo imagen: " + error.message);
    } else {
      // Obtenemos el link eterno
      const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, imagen_url: publicUrl }));
    }
    setLoading(false);
  };

  // --- GUARDADO FINAL (INSERT O UPDATE) ---
  const handleSave = async () => {
    if (!formData.nombre || !formData.sku || !formData.precio_venta) {
      return alert("Campos obligatorios: Nombre, SKU y Precio Venta");
    }
    setLoading(true);

    const payload = {
      nombre: formData.nombre.toUpperCase(),
      sku: formData.sku,
      categoria: formData.categoria,
      precio_costo: parseFloat(formData.precio_costo) || 0,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      stock_actual: parseFloat(formData.stock_actual) || 0,
      proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
      imagen_url: formData.imagen_url,
      activo: true
    };

    const { error } = formData.id 
      ? await supabase.from('productos').update(payload).eq('id', formData.id) // Actualizar
      : await supabase.from('productos').insert([payload]); // Crear nuevo

    if (!error) {
      alert("¡Producto guardado en Inventario! 🚀");
      onBack(); // Volver al menú
    } else {
      alert("Error al guardar en Base de Datos: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12 bg-black p-6 rounded-3xl border border-white/5 sticky top-20 z-50 backdrop-blur-xl">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all text-gray-500 hover:text-white"><ArrowLeft size={20}/></button>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-center">Gestión de <span className="text-green-500">Inventario 360°</span></h2>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 p-4 rounded-2xl shadow-lg shadow-green-900/20 active:scale-95"><Camera size={20}/></button>
        </div>

        {loading && <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center font-black text-green-500 animate-pulse uppercase tracking-[0.3em]">Procesando Titanium OS...</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* LADO IZQUIERDO: MULTIMEDIA Y IDENTIFICACIÓN */}
          <div className="space-y-8">
            {/* CARGA DE FOTO */}
            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 relative">
              <label className="text-[9px] font-black text-gray-500 uppercase mb-4 block">Imagen del Producto (Tocar para subir)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video bg-black border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-green-500/50 transition-colors"
              >
                {formData.imagen_url ? (
                  <img src={formData.imagen_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Producto" />
                ) : (
                  <div className="text-center p-6">
                    <UploadCloud size={40} className="text-gray-700 mb-3 mx-auto" />
                    <p className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Tomar Foto o Subir Archivo</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
              </div>
            </div>

            {/* DATOS BÁSICOS */}
            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 space-y-6">
               <div className="border-b border-white/5 pb-4">
                 <label className="text-[9px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2"><QrCode size={12}/> Código SKU (Barras)</label>
                 <input 
                  type="text" 
                  value={formData.sku}
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                  className="w-full bg-transparent py-2 text-xl font-black uppercase outline-none focus:border-green-500 transition-all text-green-500"
                  placeholder="Escanea o escribe el código"
                 />
               </div>
               <div>
                 <label className="text-[9px] font-black text-gray-500 uppercase mb-2 block flex items-center gap-2"><Package size={12}/> Nombre del Producto</label>
                 <input 
                  type="text" 
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full bg-transparent py-2 text-2xl font-black uppercase italic outline-none focus:border-green-500 transition-all text-white placeholder:text-gray-800"
                  placeholder="EJ. LECHE NIDO 360G"
                 />
               </div>
            </div>
          </div>

          {/* LADO DERECHO: FINANZAS Y LOGÍSTICA */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* PROVEEDOR */}
               <div className="bg-[#0A0A0A] p-6 rounded-[30px] border border-white/5 flex flex-col justify-center">
                 <label className="text-[9px] font-black text-gray-400 uppercase mb-3 block flex items-center gap-2"><Truck size={12}/> Proveedor</label>
                 <select 
                  value={formData.proveedor_id}
                  onChange={e => setFormData({...formData, proveedor_id: e.target.value})}
                  className="w-full bg-transparent text-[11px] font-black uppercase outline-none appearance-none cursor-pointer"
                 >
                   <option value="" className="bg-black text-gray-500">Seleccionar...</option>
                   {proveedores.map(p => <option key={p.id} value={p.id} className="bg-black text-white">{p.nombre}</option>)}
                 </select>
               </div>
               {/* EXISTENCIA */}
               <div className="bg-[#0A0A0A] p-6 rounded-[30px] border border-white/5 flex flex-col justify-center">
                 <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block flex items-center gap-2"><Package size={12}/> Existencia Actual</label>
                 <input 
                  type="number" 
                  value={formData.stock_actual}
                  onChange={e => setFormData({...formData, stock_actual: e.target.value})}
                  className="w-full bg-transparent text-3xl font-black outline-none text-white placeholder:text-gray-800"
                  placeholder="0"
                 />
               </div>
            </div>

            {/* PRECIOS Y RENTABILIDAD */}
            <div className="bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5 space-y-8">
               <div className="flex justify-between items-center bg-black/30 p-5 rounded-2xl border border-white/5">
                 <label className="text-[10px] font-black text-gray-400 uppercase flex items-center gap-2"><DollarSign size={14}/> Precio Costo</label>
                 <input 
                  type="number" 
                  value={formData.precio_costo}
                  onChange={e => setFormData({...formData, precio_costo: e.target.value})}
                  className="bg-transparent text-right text-2xl font-black outline-none w-40 text-white placeholder:text-gray-800"
                  placeholder="0.00"
                 />
               </div>
               <div className="flex justify-between items-center bg-green-950/20 p-5 rounded-2xl border border-green-500/10 shadow-inner">
                 <label className="text-[10px] font-black text-green-500 uppercase flex items-center gap-2"><BarChart3 size={14}/> Precio Venta</label>
                 <input 
                  type="number" 
                  value={formData.precio_venta}
                  onChange={e => setFormData({...formData, precio_venta: e.target.value})}
                  className="bg-transparent text-right text-4xl font-black text-green-500 outline-none w-40 placeholder:text-gray-800"
                  placeholder="0.00"
                 />
               </div>
            </div>

            {/* BOTÓN GUARDAR */}
            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-100 text-black py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:pointer-events-none mt-8"
            >
              <Save size={18}/> {formData.id ? 'Actualizar Producto' : 'Registrar Nuevo Producto'}
            </button>
          </div>
        </div>
        
        <div className="text-center mt-12 pt-8 border-t border-white/5">
            <p className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em]">Amoree Business OS - Vision Module v1.0</p>
        </div>
      </div>

      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
