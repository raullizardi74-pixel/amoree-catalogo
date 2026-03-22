import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { 
  Trash2, Camera, Search, X, Save, 
  AlertTriangle, ArrowLeft, ChevronRight, Info, Zap 
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
      // 1. Registro en tabla 'merma' (tus columnas exactas)
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
      fetchProducts(); // Refrescar stock local
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

  if (loading) return <div className="p-10 text-red-500 font-black animate-pulse">Iniciando Auditoría de Desperdicio...</div>;

  return (
    <div className="animate-in fade-in duration-700 min-h-screen pb-20">
      {/* HEADER TITANIUM */}
      <div className="flex items-center justify-between mb-10 bg-[#0A0A0A] p-8 rounded-[40px] border border-white/5">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all active:scale-90">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-4xl font-black uppercase italic tracking-tighter">
              Control de <span className="text-red-500">Mermas</span>
            </h2>
            <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] uppercase mt-1 italic">Amoree Waste Management</p>
          </div>
        </div>
        <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-3xl flex items-center justify-center text-red-500">
           <Trash2 size={32} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* BUSCADOR / ESCÁNER */}
        <div className="space-y-6">
          {!selectedProduct ? (
            <div className="bg-[#0A0A0A] border border-white/5 rounded-[50px] p-10 shadow-2xl">
              <div className="flex gap-4 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <input 
                    type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-3xl py-5 pl-14 pr-6 text-sm font-bold uppercase outline-none focus:border-red-500/40 transition-all"
                  />
                </div>
                <button onClick={() => setShowScanner(true)} className="bg-red-600 hover:bg-red-500 p-5 rounded-3xl text-white shadow-lg shadow-red-900/20 active:scale-90 transition-all">
                  <Camera size={24} />
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar pr-2">
                {searchTerm && filteredProducts.map(p => (
                  <button 
                    key={p.id} onClick={() => handleSelectProduct(p)}
                    className="w-full bg-white/[0.02] hover:bg-red-500/5 border border-white/5 hover:border-red-500/30 p-6 rounded-[30px] flex justify-between items-center group transition-all"
                  >
                    <div className="text-left">
                      <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1">{p.categoria}</p>
                      <p className="text-sm font-black uppercase italic text-white group-hover:text-red-500 transition-colors">{p.nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-500 mb-1">STOCK</p>
                      <p className="text-xs font-black text-white">{p.stock_actual} {p.unidad}</p>
                    </div>
                  </button>
                ))}
                {searchTerm && filteredProducts.length === 0 && (
                  <div className="text-center py-20 opacity-30">
                    <p className="text-xs font-black uppercase tracking-widest">Sin resultados</p>
                  </div>
                )}
                {!searchTerm && (
                  <div className="py-24 text-center">
                    <Zap className="mx-auto text-gray-900 mb-6" size={48} />
                    <p className="text-[10px] text-gray-700 uppercase font-black tracking-[0.4em]">Inicia escaneo o busca manual</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* INFO PRODUCTO SELECCIONADO */
            <div className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 rounded-[50px] p-12 relative overflow-hidden">
               <div className="absolute -top-10 -right-10 p-10 opacity-5">
                 <Trash2 size={250} />
               </div>
               <button onClick={() => setSelectedProduct(null)} className="mb-10 text-[10px] font-black uppercase text-gray-500 flex items-center gap-2 hover:text-white transition-colors">
                 <X size={14}/> Cancelar selección
               </button>
               
               <p className="text-red-500 font-black text-[10px] tracking-widest uppercase mb-2">{selectedProduct.categoria}</p>
               <h3 className="text-5xl font-black uppercase italic leading-none mb-6 tracking-tighter">{selectedProduct.nombre}</h3>
               
               <div className="grid grid-cols-2 gap-4 mt-12">
                  <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Costo Promedio</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(selectedProduct.costo)}</p>
                  </div>
                  <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-2">Stock Disponible</p>
                    <p className="text-2xl font-black text-white">{selectedProduct.stock_actual} <span className="text-[10px] text-gray-500 font-bold uppercase">{selectedProduct.unidad}</span></p>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* PANEL DE ACCIÓN - MERMA */}
        <div className={selectedProduct ? 'animate-in slide-in-from-right duration-700' : 'opacity-10 pointer-events-none'}>
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-12 space-y-10 shadow-2xl">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-6 block tracking-widest">1. Cantidad a dar de baja ({selectedProduct?.unidad})</label>
              <div className="relative">
                <input 
                  type="number" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-white/10 rounded-3xl py-8 px-10 text-6xl font-black text-red-500 outline-none focus:border-red-600 transition-all placeholder:opacity-10"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-6 block tracking-widest">2. Motivo de la Merma</label>
              <div className="grid grid-cols-2 gap-4">
                {MOTIVOS.map(m => (
                  <button 
                    key={m.id} onClick={() => setMotivo(m.id)}
                    className={`p-6 rounded-3xl border text-[10px] font-black uppercase flex items-center justify-center gap-3 transition-all ${
                      motivo === m.id ? 'bg-red-600 border-red-600 text-white shadow-xl shadow-red-900/30' : 'bg-black border-white/5 text-gray-600 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xl">{m.icon}</span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-10 border-t border-white/5">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Pérdida Auditada</p>
                  <p className="text-[8px] text-red-500/60 uppercase font-black">Este monto se restará de la utilidad</p>
                </div>
                <p className="text-5xl font-black text-white tabular-nums tracking-tighter">
                  -{formatCurrency(parseFloat(cantidad || '0') * (selectedProduct?.costo || 0))}
                </p>
              </div>

              <button 
                onClick={ejecutarCompraMaestra} disabled={issubmitting}
                className="w-full bg-white text-black py-8 rounded-[30px] font-black uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl hover:bg-red-600 hover:text-white"
              >
                {issubmitting ? 'Procesando Baja...' : 'Confirmar Baja Titanium'}
              </button>
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
