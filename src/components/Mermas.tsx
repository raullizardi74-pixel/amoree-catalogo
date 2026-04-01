import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
// import { Scanner } from './Scanner'; // Comentado por si acaso falla el archivo
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
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cantidad, setCantidad] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Merma Natural');

  useEffect(() => { fetchProducts(); }, []);

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

  const ejecutarRegistroMerma = async () => {
    if (!selectedProduct || !cantidad || parseFloat(cantidad) <= 0) return alert("Socio, indica una cantidad.");
    const cantNum = parseFloat(cantidad);
    const perdidaTotal = cantNum * (selectedProduct.costo || 0);

    setIsSubmitting(true);
    try {
      await supabase.from('merma').insert({
        producto_sku: selectedProduct.sku,
        nombre_producto: selectedProduct.nombre,
        cantidad: cantNum,
        unidad: selectedProduct.unidad,
        costo_unitario: selectedProduct.costo || 0,
        total_perdida: perdidaTotal,
        motivo: motivo,
        categoria: selectedProduct.categoria
      });

      await supabase.from('productos').update({ stock_actual: (selectedProduct.stock_actual || 0) - cantNum }).eq('id', selectedProduct.id);

      alert(`✅ Merma registrada: ${formatCurrency(perdidaTotal)}`);
      setSelectedProduct(null);
      fetchProducts(); 
    } catch (e) { alert("Error al registrar."); } finally { setIsSubmitting(false); }
  };

  const filteredProducts = products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="py-20 text-center"><Zap className="text-red-500 animate-pulse mx-auto" size={48} /></div>;

  return (
    <div className="flex flex-col font-sans text-white bg-black min-h-screen">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#050505]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-all"><ArrowLeft size={20} /></button>
          <div>
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Control de <span className="text-red-500">Mermas</span></h2>
            <p className="text-[8px] text-gray-500 font-black tracking-[0.3em] uppercase italic">Amoree Waste Management</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-10 space-y-8 pb-32 no-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          <div className="space-y-6">
            {!selectedProduct ? (
              <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-8">
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-xs font-bold uppercase outline-none" />
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
                  {searchTerm && filteredProducts.map(p => (
                    <button key={p.id} onClick={() => handleSelectProduct(p)} className="w-full bg-white/[0.02] border border-white/5 p-4 rounded-3xl flex justify-between items-center group transition-all">
                      <div className="text-left">
                        <p className="text-[7px] text-gray-600 uppercase font-black mb-1">{p.categoria}</p>
                        <p className="text-xs font-black uppercase italic text-white group-hover:text-red-500">{p.nombre}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 rounded-[40px] p-10">
                 <button onClick={() => setSelectedProduct(null)} className="mb-8 text-[9px] font-black uppercase text-gray-500 flex items-center gap-2"><X size={14}/> Cambiar selección</button>
                 <h3 className="text-4xl font-black uppercase italic mb-6 tracking-tighter">{selectedProduct.nombre}</h3>
              </div>
            )}
          </div>

          <div className={selectedProduct ? 'opacity-100' : 'opacity-10 pointer-events-none'}>
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[40px] p-8 space-y-8">
              <input type="number" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0.00" className="w-full bg-black border border-white/10 rounded-2xl py-6 px-8 text-5xl font-black text-red-500 outline-none" />
              <div className="grid grid-cols-2 gap-2">
                {MOTIVOS.map(m => (
                  <button key={m.id} onClick={() => setMotivo(m.id)} className={`p-4 rounded-2xl border text-[9px] font-black uppercase flex items-center justify-center gap-2 ${motivo === m.id ? 'bg-red-600 text-white' : 'bg-black border-white/5 text-gray-600'}`}>{m.icon} {m.label}</button>
                ))}
              </div>
              <button onClick={ejecutarRegistroMerma} disabled={issubmitting} className="w-full bg-white text-black py-6 rounded-[24px] font-black uppercase text-[10px] active:scale-95 transition-all">Confirmar Baja</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
