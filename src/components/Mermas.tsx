import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { 
  Trash2, Camera, Search, X, 
  ArrowLeft, ChevronRight, Info, Zap 
} from 'lucide-react';

const MOTIVOS = [
  { id: 'Merma Natural', label: 'Merma Natural', icon: '🍃' },
  { id: 'Dañado', label: 'Producto Dañado', icon: '📦' },
  { id: 'Caducado', label: 'Fecha Vencida', icon: '⏰' },
  { id: 'Podrido', label: 'Descomposición', icon: '🍎' }
];

export default function Mermas({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  
  // Estado del Registro
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cantidad, setCantidad] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Merma Natural');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    if (data) setProducts(data);
    setLoading(false);
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setCantidad('');
  };

  const handleScanSuccess = (decodedText: string) => {
    const product = products.find(p => p.sku === decodedText || p.SKU === decodedText);
    if (product) {
      handleSelectProduct(product);
      setShowScanner(false);
    } else {
      alert("⚠️ Código no reconocido. Intenta buscarlo manualmente.");
    }
  };

  // ✅ FUNCIÓN CORREGIDA
  const ejecutarRegistroMerma = async () => {
    if (!selectedProduct || !cantidad || parseFloat(cantidad) <= 0) {
      return alert("Socio, indica una cantidad válida.");
    }

    const cantNum = parseFloat(cantidad);
    const perdidaTotal = cantNum * (selectedProduct.costo || 0);

    if (cantNum > selectedProduct.stock_actual) {
      if (!window.confirm(`⚠️ Hugo, estás mermando ${cantNum} pero solo hay ${selectedProduct.stock_actual} en stock. ¿Continuar?`)) return;
    }

    setIsSubmitting(true);
    try {
      // 1. Registro en tabla 'merma'
      const { error: errMerma } = await supabase
        .from('merma')
        .insert({
          producto_sku: selectedProduct.sku,
          nombre_producto: selectedProduct.nombre,
          cantidad: cantNum,
          unidad: selectedProduct.unidad,
          costo_unitario: selectedProduct.costo || 0,
          total_perdida: perdidaTotal,
          motivo: motivo,
          categoria: selectedProduct.categoria
        });

      if (errMerma) throw errMerma;

      // 2. Descuento de Inventario
      const { error: errStock } = await supabase
        .from('productos')
        .update({ stock_actual: (selectedProduct.stock_actual || 0) - cantNum })
        .eq('id', selectedProduct.id);

      if (errStock) throw errStock;

      alert(`✅ Merma registrada con éxito. Pérdida: ${formatCurrency(perdidaTotal)}`);
      setSelectedProduct(null);
      fetchProducts(); 
    } catch (e) {
      console.error(e);
      alert("Error al registrar la merma.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.includes(searchTerm)
  );

  if (loading) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]">
      <div className="text-center">
        <Zap className="mx-auto text-red-500 animate-pulse mb-4" size={48} />
        <p className="text-red-500 font-black uppercase tracking-[0.3em] text-xs">Cargando Auditoría...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden animate-in fade-in duration-500">
      
      {/* HEADER TITANIUM */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#050505]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">
              Control de <span className="text-red-500">Mermas</span>
            </h2>
            <p className="text-[8px] text-gray-500 font-black tracking-[0.3em] uppercase italic">Amoree Waste Management</p>
          </div>
        </div>
        <Trash2 className="text-red-600/40" size={24} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-10 space-y-8 pb-32 no-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          
          {/* BUSCADOR / ESCÁNER */}
          <div className="space-y-6">
            {!selectedProduct ? (
              <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8 shadow-2xl">
                <div className="flex gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                      type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-xs font-bold uppercase outline-none focus:border-red-500/40"
                    />
                  </div>
                  <button onClick={() => setShowScanner(true)} className="bg-red-600 p-4 rounded-2xl text-white active:scale-90 transition-all">
                    <Camera size={20} />
                  </button>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
                  {searchTerm && filteredProducts.map(p => (
                    <button 
                      key={p.id} onClick={() => handleSelectProduct(p)}
                      className="w-full bg-white/[0.02] hover:bg-red-500/5 border border-white/5 p-4 rounded-3xl flex justify-between items-center group transition-all"
                    >
                      <div className="text-left">
                        <p className="text-[7px] text-gray-600 uppercase font-black mb-1">{p.categoria}</p>
                        <p className="text-xs font-black uppercase italic text-white group-hover:text-red-500">{p.nombre}</p>
                      </div>
                      <p className="text-[10px] font-black text-gray-500">{p.stock_actual} {p.unidad}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* INFO PRODUCTO SELECCIONADO */
              <div className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 rounded-[40px] p-10 relative overflow-hidden">
                 <button onClick={() => setSelectedProduct(null)} className="mb-8 text-[9px] font-black uppercase text-gray-500 flex items-center gap-2">
                   <X size={14}/> Cambiar selección
                 </button>
                 <h3 className="text-4xl font-black uppercase italic leading-none mb-6 tracking-tighter">{selectedProduct.nombre}</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Costo</p>
                      <p className="text-lg font-black text-white">{formatCurrency(selectedProduct.costo)}</p>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Stock</p>
                      <p className="text-lg font-black text-white">{selectedProduct.stock_actual} {selectedProduct.unidad}</p>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* PANEL DE ACCIÓN */}
          <div className={selectedProduct ? 'animate-in slide-in-from-right duration-700' : 'opacity-10 pointer-events-none'}>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 space-y-8 shadow-2xl">
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase mb-4 block">1. Cantidad a mermar ({selectedProduct?.unidad})</label>
                <input 
                  type="number" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-white/10 rounded-2xl py-6 px-8 text-5xl font-black text-red-500 outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase mb-4 block">2. Motivo</label>
                <div className="grid grid-cols-2 gap-2">
                  {MOTIVOS.map(m => (
                    <button 
                      key={m.id} onClick={() => setMotivo(m.id)}
                      className={`p-4 rounded-2xl border text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${
                        motivo === m.id ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-black border-white/5 text-gray-600'
                      }`}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Pérdida Estimada</p>
                  <p className="text-3xl font-black text-white">
                    -{formatCurrency(parseFloat(cantidad || '0') * (selectedProduct?.costo || 0))}
                  </p>
                </div>

                <button 
                  onClick={ejecutarRegistroMerma} 
                  disabled={issubmitting}
                  className="w-full bg-white text-black py-6 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-red-600 hover:text-white"
                >
                  {issubmitting ? 'Procesando...' : 'Confirmar Baja'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showScanner && (
        <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
