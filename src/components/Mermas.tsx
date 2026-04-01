import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Trash2, Search, X, Zap } from 'lucide-react';

export default function Mermas({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cantidad, setCantidad] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('productos').select('*').eq('activo', true);
      if (data) setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const ejecutarMerma = async () => {
    if (!selectedProduct || !cantidad) return alert("Indica cantidad.");
    try {
      await supabase.from('merma').insert({
        producto_sku: selectedProduct.sku,
        nombre_producto: selectedProduct.nombre,
        cantidad: parseFloat(cantidad),
        total_perdida: parseFloat(cantidad) * (selectedProduct.costo || 0),
        motivo: 'Merma Natural'
      });
      await supabase.from('productos').update({ stock_actual: (selectedProduct.stock_actual || 0) - parseFloat(cantidad) }).eq('id', selectedProduct.id);
      alert("✅ Merma registrada.");
      onBack();
    } catch (e) { alert("Error."); }
  };

  if (loading) return <div className="py-20 text-center"><Zap className="mx-auto text-red-500 animate-pulse" size={48} /></div>;

  return (
    <div className="bg-white min-h-screen pb-40">
      <div className="p-6 bg-red-600 text-white flex justify-between items-center">
        <h2 className="text-xl font-black uppercase italic">Control de <span className="text-black">Mermas</span></h2>
        <button onClick={onBack} className="bg-black/10 p-2 rounded-xl"><X size={20}/></button>
      </div>

      <div className="p-6">
        {!selectedProduct ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input type="text" placeholder="BUSCAR PRODUCTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-100 border-none rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none" />
            </div>
            <div className="grid gap-2">
              {searchTerm && products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                <button key={p.id} onClick={() => setSelectedProduct(p)} className="p-4 bg-white border border-gray-100 rounded-2xl text-left font-black uppercase text-xs hover:bg-gray-50">{p.nombre}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom">
            <div className="bg-gray-50 p-8 rounded-[40px] text-center">
              <h3 className="text-2xl font-black uppercase italic mb-2">{selectedProduct.nombre}</h3>
              <p className="text-[10px] font-bold text-gray-400">STOCK ACTUAL: {selectedProduct.stock_actual} {selectedProduct.unidad}</p>
            </div>
            <input type="number" placeholder="CANTIDAD A MERMAR" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full bg-gray-100 border-none rounded-3xl py-6 px-8 text-4xl font-black text-red-600 text-center outline-none" />
            <button onClick={ejecutarMerma} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Confirmar Baja</button>
            <button onClick={() => setSelectedProduct(null)} className="w-full text-[10px] font-black text-gray-400 uppercase">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
