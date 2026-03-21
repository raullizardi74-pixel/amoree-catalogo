import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { 
  Zap, Target, Minus, Plus, ChevronDown, 
  Clock, Save, EyeOff, Eye, Search, X, TrendingUp, Truck
} from 'lucide-react';
import { format } from 'date-fns';

const OBJETIVOS_UTILIDAD: Record<string, number> = {
  'Frutas': 0.40, 'Verduras': 0.30, 'Hojas y tallos': 0.42, 
  'Abarrotes': 0.30, 'Cremería': 0.22, 'Otros': 0.15
};

const redondearPrecio = (precio: number) => Math.round(precio * 2) / 2;

export default function RutaDeCompra({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [issubmitting, setIsSubmitting] = useState(false);
  const [coverageDays, setCoverageDays] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [registroCompra, setRegistroCompra] = useState<Record<string, any>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prodData } = await supabase.from('productos').select('*');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: orderData } = await supabase
        .from('pedidos')
        .select('detalle_pedido')
        .eq('estado', 'Finalizado')
        .gte('created_at', sevenDaysAgo.toISOString());
        
      if (prodData) setProducts(prodData);
      if (orderData) setSalesData(orderData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const analysis = useMemo(() => {
    let rawData = products.map(p => {
      let totalVendido = 0;
      salesData.forEach(order => {
        const item = order.detalle_pedido?.find((i: any) => (i.sku || i.SKU) === p.sku);
        if (item) totalVendido += (item.quantity || 0);
      });
      const promedioDiario = totalVendido / 7;
      const diasRestantes = promedioDiario > 0 ? p.stock_actual / promedioDiario : 99;
      const sugerido = Math.max(0, (promedioDiario * coverageDays) - p.stock_actual);

      let urgencia = 3;
      if (p.stock_actual === 0) urgencia = 0;
      else if (p.stock_actual <= 5) urgencia = 1;
      else if (diasRestantes < 1.5) urgencia = 2;

      return { 
        ...p, promedioDiario, diasRestantes, sugerido: Number(sugerido.toFixed(1)), 
        urgencia, margenObjetivo: OBJETIVOS_UTILIDAD[p.categoria] || 0.15 
      };
    });

    if (searchTerm) {
      rawData = rawData.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return rawData.sort((a, b) => a.urgencia - b.urgencia || a.stock_actual - b.stock_actual);
  }, [products, salesData, coverageDays, searchTerm]);

  const categoriesOrdered = useMemo(() => {
    const cats = Array.from(new Set(analysis.map(p => p.categoria || 'Otros')));
    return cats.sort((a, b) => {
      const minUrgA = Math.min(...analysis.filter(p => p.categoria === a).map(p => p.urgencia));
      const minUrgB = Math.min(...analysis.filter(p => p.categoria === b).map(p => p.urgencia));
      return minUrgA - minUrgB;
    });
  }, [analysis]);

  const toggleActivo = async (sku: string, estadoActual: any) => {
    const nuevoEstado = !(estadoActual === false ? false : true);
    try {
      await supabase.from('productos').update({ activo: nuevoEstado }).eq('sku', sku);
      setProducts(prev => prev.map(p => p.sku === sku ? { ...p, activo: nuevoEstado } : p));
    } catch (e) { console.error(e); }
  };

  const updateRegistro = (sku: string, field: string, value: any, itemRef?: any) => {
    setRegistroCompra(prev => {
      const current = prev[sku] || { 
        cantidad: 0, costo_central: itemRef?.costo || 0, 
        precio_venta: itemRef?.precio_venta || 0, margen_actual: itemRef?.margenObjetivo || 0.15
      };
      let updated = { ...current, [field]: value };
      if (field === 'costo_central' || field === 'margen_actual') {
        updated.precio_venta = redondearPrecio(updated.costo_central * (1 + updated.margen_actual));
      }
      return { ...prev, [sku]: updated };
    });
  };

  const ejecutarCompraMaestra = async () => {
    const itemsAComprar = Object.entries(registroCompra).filter(([_, val]) => val.cantidad > 0);
    
    if (itemsAComprar.length === 0) return alert("No hay productos con cantidad para comprar.");

    const pendientes = analysis.filter(p => p.activo !== false && p.urgencia <= 1 && (!registroCompra[p.sku] || registroCompra[p.sku].cantidad === 0));
    if (pendientes.length > 0) {
      const nombres = pendientes.slice(0, 5).map(p => `- ${p.nombre}`).join('\n');
      const msg = `⚠️ ATENCIÓN HUGO:\nFaltan ${pendientes.length} AGOTADOS/CRÍTICOS:\n${nombres}\n\n¿Finalizar de todos modos?`;
      if (!window.confirm(msg)) return;
    }

    setIsSubmitting(true);
    try {
      // 1. Calcular total de la ruta
      const totalRuta = itemsAComprar.reduce((acc, [_, data]) => acc + (data.cantidad * data.costo_central), 0);

      // 2. Crear cabecera (Proveedor ID 1 suele ser 'Varios/Ruta')
      const { data: compraHeader, error: errH } = await supabase
        .from('compras')
        .insert({
          proveedor_id: 1, 
          folio: `RUTA-${format(new Date(), 'ddMMyy-HHmm')}`,
          total: totalRuta
        })
        .select().single();

      if (errH) throw errH;

      // 3. Insertar detalles y actualizar stock
      for (const [sku, data] of itemsAComprar) {
        const prod = products.find(p => p.sku === sku);
        
        // Detalle
        await supabase.from('compras_detalle').insert({
          compra_id: compraHeader.id,
          nombre: prod.nombre,
          cantidad: data.cantidad,
          costo_unitario: data.costo_central,
          subtotal: data.cantidad * data.costo_central
        });

        // Actualizar Producto
        await supabase.from('productos').update({
          costo: data.costo_central, 
          precio_venta: data.precio_venta,
          stock_actual: prod.stock_actual + data.cantidad
        }).eq('sku', sku);
      }

      alert("✅ ¡Sincronizado! El inventario y las métricas se actualizaron.");
      onBack();
    } catch (e) { 
      console.error(e);
      alert("Error al sincronizar con la base de datos."); 
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-white overflow-hidden">
      {/* HEADER */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">Atrás</button>
        <div className="text-center">
          <h2 className="text-xs font-black uppercase italic tracking-tighter">Hugo <span className="text-green-500">Master</span></h2>
          <p className="text-[7px] text-gray-500 font-bold tracking-widest uppercase">Central de Abastos OS</p>
        </div>
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-black font-black text-[10px] shadow-lg shadow-green-900/20">🛒</div>
      </div>

      {/* SEARCH & COBERTURA */}
      <div className="p-3 bg-[#050505] border-b border-white/10 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input 
            type="text" placeholder="BUSCAR ARTÍCULO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-[10px] font-bold text-green-500 uppercase outline-none focus:border-green-500/30"
          />
        </div>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
             <Clock size={12} className="text-gray-500" />
             <p className="text-[8px] font-black uppercase text-gray-400">Cobertura:</p>
          </div>
          <div className="flex bg-black p-1 rounded-xl border border-white/5">
            {[2, 3, 5, 7].map(d => (
              <button key={d} onClick={() => setCoverageDays(d)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black transition-all ${coverageDays === d ? 'bg-white text-black' : 'text-gray-500'}`}>{d}D</button>
            ))}
          </div>
        </div>
      </div>

      {/* LISTADO */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
        {categoriesOrdered.map(cat => {
          const items = analysis.filter(p => (p.categoria || 'Otros') === cat);
          const minUrg = Math.min(...items.map(i => i.urgencia));
          const colorCat = minUrg === 0 ? 'bg-red-600' : minUrg === 1 ? 'bg-orange-500' : 'bg-green-500';
          const isExpanded = expandedCategory === cat || searchTerm.length > 0;

          return (
            <div key={cat} className={`rounded-[30px] border transition-all ${isExpanded ? 'bg-[#080808] border-white/10' : 'border-white/5'}`}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)} className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className={`w-2 h-2 rounded-full ${colorCat}`}></div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest">{cat} ({items.length})</h3>
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-6 space-y-4">
                  {items.map(item => {
                    const data = registroCompra[item.sku] || { cantidad: 0, costo_central: item.costo, precio_venta: item.precio_venta, margen_actual: item.margenObjetivo };
                    return (
                      <div key={item.sku} className={`p-5 rounded-[28px] border bg-white/[0.02] border-white/5 ${item.activo === false && 'opacity-30'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[11px] font-black uppercase text-white">{item.nombre}</p>
                              <button onClick={() => toggleActivo(item.sku, item.activo)} className="p-1">
                                {item.activo !== false ? <Eye size={10} className="text-green-500"/> : <EyeOff size={10} className="text-red-500"/>}
                              </button>
                            </div>
                            <p className="text-[7px] text-gray-500 font-bold uppercase">Costo Ref: {formatCurrency(item.costo)}</p>
                          </div>
                          <div className="text-right">
                            <div className="bg-black/40 px-2 py-1 rounded-lg text-[9px] font-black">{item.stock_actual} {item.unidad}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <label className="text-[7px] text-gray-500 uppercase ml-2">Cant.</label>
                            <input type="number" value={data.cantidad || ''} onChange={(e) => updateRegistro(item.sku, 'cantidad', parseFloat(e.target.value), item)}
                              className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xl font-black text-green-500 outline-none" placeholder={item.sugerido} />
                          </div>
                          <div>
                            <label className="text-[7px] text-gray-500 uppercase ml-2">Costo Nuevo</label>
                            <input type="number" value={data.costo_central} onChange={(e) => updateRegistro(item.sku, 'costo_central', parseFloat(e.target.value), item)}
                              className="w-full bg-black border border-white/10 rounded-2xl p-4 text-xl font-black text-white outline-none" />
                          </div>
                        </div>

                        <div className="mt-4 bg-green-500/5 p-4 rounded-2xl flex justify-between items-center border border-green-500/10">
                          <div>
                            <p className="text-[7px] font-black text-green-500 uppercase">Precio Sugerido Venta</p>
                            <p className="text-xl font-black">{formatCurrency(data.precio_venta)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[7px] font-black text-gray-500 uppercase">Margen</p>
                            <p className="text-xs font-black">{(data.margen_actual * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="p-6 bg-black border-t border-white/10">
        <div className="flex justify-between items-center mb-4">
          <p className="text-[10px] font-black text-gray-500 uppercase">Total Inversión</p>
          <p className="text-2xl font-black">{formatCurrency(Object.values(registroCompra).reduce((acc, curr) => acc + (curr.cantidad * (curr.costo_central || 0)), 0))}</p>
        </div>
        <button onClick={ejecutarCompraMaestra} disabled={issubmitting}
          className="w-full bg-green-600 h-16 rounded-3xl text-black font-black uppercase text-xs active:scale-95 transition-all">
          {issubmitting ? 'Sincronizando...' : 'Finalizar Operación'}
        </button>
      </div>
    </div>
  );
}
