import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Trash2, Search, X, Zap, AlertTriangle, 
  TrendingDown, Send, ArrowLeft, History
} from 'lucide-react';

const MOTIVOS = [
  { id: 'Merma Natural', label: 'Merma Natural', icon: '🍃' },
  { id: 'Dañado', label: 'Producto Dañado', icon: '📦' },
  { id: 'Caducado', label: 'Fecha Vencida', icon: '⏰' },
  { id: 'Podrido', label: 'Descomposición', icon: '🍎' }
];

export default function Mermas({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [cantidad, setCantidad] = useState<string>('');
  const [motivo, setMotivo] = useState<string>('Merma Natural');
  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [avgCost, setAvgCost] = useState<number>(0);
  const [issubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    if (data) setProducts(data);
    setLoading(false);
  };

  // ✅ CEREBRO: Calcular Costo Promedio (7 días)
  const fetchAverageCost = async (sku: string, baseCost: number) => {
    setIsCalculating(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: compras } = await supabase
        .from('compras')
        .select('total_compra, cantidad')
        .eq('producto_sku', sku)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (compras && compras.length > 0) {
        const totalDinero = compras.reduce((acc, c) => acc + (c.total_compra || 0), 0);
        const totalCant = compras.reduce((acc, c) => acc + (c.cantidad || 0), 0);
        setAvgCost(totalCant > 0 ? totalDinero / totalCant : baseCost);
      } else {
        setAvgCost(baseCost);
      }
    } catch (e) {
      setAvgCost(baseCost);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setCantidad('');
    fetchAverageCost(product.sku, product.costo || 0);
  };

  const lossValue = useMemo(() => {
    return (parseFloat(cantidad) || 0) * avgCost;
  }, [cantidad, avgCost]);

  const ejecutarRegistroMerma = async () => {
    if (!selectedProduct || !cantidad || parseFloat(cantidad) <= 0) return alert("Socio, indica una cantidad válida.");
    
    setIsSubmitting(true);
    try {
      // 1. Registrar en Supabase
      const { error: errMerma } = await supabase.from('merma').insert({
        producto_sku: selectedProduct.sku,
        nombre_producto: selectedProduct.nombre,
        cantidad: parseFloat(cantidad),
        unidad: selectedProduct.unidad,
        costo_unitario: avgCost,
        total_perdida: lossValue,
        motivo: motivo,
        categoria: selectedProduct.categoria
      });

      if (errMerma) throw errMerma;

      // 2. Actualizar Stock
      await supabase.from('productos').update({ 
        stock_actual: (selectedProduct.stock_actual || 0) - parseFloat(cantidad) 
      }).eq('sku', selectedProduct.sku);

      // 3. Notificar a Raúl vía WhatsApp
      let msg = `*REPORTE DE MERMA - AMOREE* 🗑️\n--------------------------\n`;
      msg += `🍎 PRODUCTO: ${selectedProduct.nombre}\n`;
      msg += `📉 CANTIDAD: ${cantidad} ${selectedProduct.unidad}\n`;
      msg += `❓ MOTIVO: ${motivo}\n`;
      msg += `💸 PÉRDIDA ESTIMADA: *${formatCurrency(lossValue)}*\n`;
      msg += `--------------------------\n_Stock actualizado automáticamente._`;

      window.open(`https://wa.me/522215306435?text=${encodeURIComponent(msg)}`, '_blank');

      alert("✅ Merma registrada y enviada a Raúl.");
      onBack();
    } catch (e) {
      alert("Error en sincronización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="py-20 text-center animate-pulse"><Zap className="mx-auto text-red-500 mb-4" size={48}/><p className="text-[10px] font-black uppercase text-gray-400">Iniciando Auditoría...</p></div>;

  return (
    <div className="bg-white min-h-screen pb-40 animate-in fade-in">
      <div className="p-6 bg-[#050505] text-white flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="bg-white/5 p-3 rounded-2xl active:scale-90 transition-all"><ArrowLeft size={20}/></button>
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Gestión de <span className="text-red-500">Merma</span></h2>
        </div>
        <Trash2 className="text-red-500/20" size={24} />
      </div>

      <div className="p-6">
        {!selectedProduct ? (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
              <input 
                type="text" 
                placeholder="BUSCAR PRODUCTO PARA BAJA..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full bg-gray-50 border-none rounded-[2rem] py-5 pl-16 pr-8 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-red-500 transition-all" 
              />
            </div>
            <div className="grid gap-3">
              {searchTerm && filteredProducts.map(p => (
                <button key={p.sku} onClick={() => handleSelectProduct(p)} className="p-5 bg-white border border-gray-100 rounded-[2rem] text-left hover:border-red-200 transition-all shadow-sm group">
                  <p className="text-[8px] font-black text-gray-400 uppercase mb-1">{p.categoria}</p>
                  <p className="font-black uppercase italic text-gray-800 group-hover:text-red-600 transition-colors">{p.nombre}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-in slide-in-from-bottom duration-500">
            {/* CARD PRODUCTO SELECCIONADO */}
            <div className="bg-red-50 border border-red-100 p-8 rounded-[3rem] text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10"><History size={60} className="text-red-600"/></div>
              <h3 className="text-3xl font-black uppercase italic text-red-900 mb-2 leading-none">{selectedProduct.nombre}</h3>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-6">Promedio 7 días: {isCalculating ? "Calculando..." : formatCurrency(avgCost)} / {selectedProduct.unidad}</p>
              
              <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl inline-block border border-red-100">
                <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Stock Actual</p>
                <p className="text-xl font-black text-black">{selectedProduct.stock_actual} {selectedProduct.unidad}</p>
              </div>
            </div>

            {/* INPUT DE CANTIDAD E IMPACTO */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-6">¿Cuánto se va a mermar?</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={cantidad} 
                  onChange={(e) => setCantidad(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full bg-gray-50 border-none rounded-[3rem] py-10 px-12 text-6xl font-black text-red-600 text-center outline-none focus:ring-4 focus:ring-red-100 transition-all" 
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-12 text-xl font-black text-gray-300 uppercase">{selectedProduct.unidad}</div>
              </div>
              
              {lossValue > 0 && (
                <div className="bg-[#050505] p-6 rounded-[2rem] flex justify-between items-center shadow-2xl animate-pulse">
                  <div>
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em]">Impacto Financiero</p>
                    <p className="text-3xl font-black text-white">{formatCurrency(lossValue)}</p>
                  </div>
                  <TrendingDown size={32} className="text-red-500" />
                </div>
              )}
            </div>

            {/* SELECTOR DE MOTIVOS */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-6">Indica el motivo</label>
              <div className="grid grid-cols-2 gap-3">
                {MOTIVOS.map(m => (
                  <button 
                    key={m.id} 
                    onClick={() => setMotivo(m.id)} 
                    className={`py-5 rounded-[2rem] border-2 font-black uppercase text-[10px] flex items-center justify-center gap-3 transition-all ${
                      motivo === m.id ? 'bg-red-600 border-red-600 text-white shadow-xl scale-105' : 'bg-white border-gray-100 text-gray-400'
                    }`}
                  >
                    <span className="text-lg">{m.icon}</span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ACCIONES FINALES */}
            <div className="pt-6 space-y-4">
              <button 
                onClick={ejecutarRegistroMerma} 
                disabled={issubmitting}
                className="w-full bg-[#050505] text-white py-8 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-xs flex items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              >
                {issubmitting ? "SINCRONIZANDO..." : <><Send size={20}/> Confirmar Baja y Avisar a Raúl</>}
              </button>
              <button onClick={() => setSelectedProduct(null)} className="w-full py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Regresar al buscador</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
