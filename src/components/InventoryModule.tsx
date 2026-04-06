import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { 
  Camera, Save, ArrowLeft, Package, Truck, DollarSign, 
  BarChart3, UploadCloud, QrCode, Search, Filter, 
  AlertCircle, History, Plus, Minus, X, CheckCircle2, ClipboardList, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

export default function InventoryModule({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // VISTAS: 'list' (Almacén general), 'mision' (Checklist de compra)
  const [activeView, setActiveView] = useState<'list' | 'mision'>('list');
  const [selectedProvider, setSelectedProvider] = useState<string>('TODOS');
  
  // Ficha de Acción Rápida (Modal)
  const [isEditing, setIsEditing] = useState(false);
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    id: null as number | null, sku: '', nombre: '', categoria: 'Abarrotes',
    costo: 0, precio_venta: 0, stock_actual: 0, proveedor_id: '', url_imagen: '', unidad: 'kg'
  });

  // Misión de Compra Items
  const [misionItems, setMisionItems] = useState<any[]>([]);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: p } = await supabase.from('productos').select('*').order('nombre');
    const { data: prov } = await supabase.from('proveedores').select('*').order('nombre');
    if (p) setProducts(p);
    if (prov) setProveedores(prov);
    setLoading(false);
  };

  // 🧠 CÁLCULOS KPI
  const stats = useMemo(() => {
    const capital = products.reduce((acc, p) => acc + ((p.stock_actual || 0) * (p.costo || 0)), 0);
    const agotados = products.filter(p => (p.stock_actual || 0) <= 0).length;
    return { capital, agotados };
  }, [products]);

  // 🔍 OBTENER HISTORIAL DE COSTOS (Últimos 3)
  const fetchHistory = async (sku: string) => {
    const { data } = await supabase
      .from('compras_detalle')
      .select('costo_unitario, created_at')
      .eq('sku', sku)
      .order('created_at', { ascending: false })
      .limit(3);
    setCostHistory(data || []);
  };

  const handleScanSuccess = async (sku: string) => {
    const found = products.find(p => p.sku === sku);
    if (found) {
      setFormData({ ...found });
      fetchHistory(sku);
    } else {
      setFormData({ ...formData, sku, id: null, nombre: '', costo: 0, stock_actual: 0 });
      setCostHistory([]);
    }
    setIsEditing(true);
    setShowScanner(false);
  };

  // 📋 LÓGICA DE MISIÓN (PEDIDO SUGERIDO)
  const startMision = (provId: string) => {
    const provName = proveedores.find(p => p.id.toString() === provId)?.nombre || 'CENTRAL';
    // Filtramos productos bajos (< 3kg o agotados) de ese proveedor
    const lowStock = products.filter(p => 
      p.proveedor_id?.toString() === provId && (p.stock_actual || 0) < 5
    ).map(p => ({
      ...p,
      cantidad_a_comprar: Math.max(0, 10 - (p.stock_actual || 0)), // Sugerimos llegar a 10
      costo_ajustado: p.costo || 0
    }));

    if (lowStock.length === 0) return alert("Socio, este proveedor tiene stock saludable.");
    
    setMisionItems(lowStock);
    setSelectedProvider(provName);
    setActiveView('mision');
  };

  const handleMisionChange = (index: number, field: string, value: number) => {
    const newItems = [...misionItems];
    newItems[index][field] = value;
    setMisionItems(newItems);
  };

  const presupuestoTotal = useMemo(() => {
    const base = misionItems.reduce((acc, i) => acc + (i.cantidad_a_comprar * i.costo_ajustado), 0);
    return { neto: base, conBuffer: base * 1.10 }; // +10% de Buffer
  }, [misionItems]);

  // ⚡ CONFIRMACIÓN ATÓMICA (EL BOTÓN MASTER)
  const confirmAndRegisterPurchase = async () => {
    if (!window.confirm("¿Confirmar recepción de mercancía y registro de gasto?")) return;
    setLoading(true);
    try {
      const totalCompra = presupuestoTotal.neto;
      // 1. Crear Header de Compra (Para Corte de Caja / Recibo)
      const { data: compraHeader } = await supabase.from('compras').insert({
        proveedor: selectedProvider,
        folio: `INV-${format(new Date(), 'ddMMyy-HHmm')}`,
        total: totalCompra,
        total_compra: totalCompra,
        metodo_pago: 'Efectivo'
      }).select().single();

      // 2. Actualizar Stock y Costos uno por uno
      for (const item of misionItems) {
        if (item.cantidad_a_comprar <= 0) continue;
        
        // Sumar stock y actualizar el costo real que Hugo pagó
        await supabase.from('productos').update({
          stock_actual: (item.stock_actual || 0) + item.cantidad_a_comprar,
          costo: item.costo_ajustado
        }).eq('id', item.id);

        // Detalle para Auditoría
        await supabase.from('compras_detalle').insert({
          compra_id: compraHeader.id,
          sku: item.sku,
          nombre: item.nombre,
          cantidad: item.cantidad_a_comprar,
          costo_unitario: item.costo_ajustado,
          subtotal: item.cantidad_a_comprar * item.costo_ajustado
        });
      }

      alert("🚀 Misión Cumplida: Stock cargado y Recibo generado.");
      setActiveView('list');
      fetchInitialData();
    } catch (e) { alert("Error en sincronización."); }
    setLoading(false);
  };

  if (activeView === 'mision') {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-6 animate-in slide-in-from-bottom">
        <div className="max-w-4xl mx-auto pb-40">
          <div className="flex justify-between items-center mb-10">
            <button onClick={() => setActiveView('list')} className="bg-white/5 p-4 rounded-2xl"><ArrowLeft/></button>
            <div className="text-center">
              <h2 className="text-xl font-black uppercase italic text-green-500">Misión: {selectedProvider}</h2>
              <p className="text-[8px] font-black text-gray-500 tracking-[0.2em]">CHECKLIST DE ABASTO</p>
            </div>
            <div className="w-12"></div>
          </div>

          <div className="space-y-4">
            {misionItems.map((item, idx) => (
              <div key={item.id} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[30px] flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-500 uppercase">{item.sku}</p>
                  <h4 className="text-lg font-black uppercase italic">{item.nombre}</h4>
                  <p className="text-[9px] text-orange-500 font-bold uppercase mt-1">Stock Actual: {item.stock_actual} {item.unidad}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black p-4 rounded-2xl border border-white/5">
                    <label className="text-[7px] text-gray-500 font-black uppercase block mb-1">Cantidad a Pedir</label>
                    <input type="number" value={item.cantidad_a_comprar} onChange={(e) => handleMisionChange(idx, 'cantidad_a_comprar', parseFloat(e.target.value))} className="w-full bg-transparent text-xl font-black text-green-500 outline-none" />
                  </div>
                  <div className="bg-black p-4 rounded-2xl border border-white/5">
                    <label className="text-[7px] text-gray-500 font-black uppercase block mb-1">Costo Real Unit.</label>
                    <input type="number" value={item.costo_ajustado} onChange={(e) => handleMisionChange(idx, 'costo_ajustado', parseFloat(e.target.value))} className="w-full bg-transparent text-xl font-black text-white outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER DE MISIÓN */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-black border-t border-white/10 z-[100] backdrop-blur-xl">
           <div className="max-w-4xl mx-auto grid grid-cols-2 gap-6 mb-4">
              <div>
                <p className="text-[8px] font-black text-gray-500 uppercase">Presupuesto Sugerido</p>
                <p className="text-2xl font-black">{formatCurrency(presupuestoTotal.neto)}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-green-500 uppercase italic">Llevar Efectivo (+10% Buffer)</p>
                <p className="text-2xl font-black text-green-500">{formatCurrency(presupuestoTotal.conBuffer)}</p>
              </div>
           </div>
           <button onClick={confirmAndRegisterPurchase} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase tracking-widest text-[11px] active:scale-95 transition-all">
              Confirmar Recepción y Registrar Gasto 🚀
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 pb-32 animate-in fade-in">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
           <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Inversión en Bodega</p>
              <h3 className="text-2xl font-black italic">{formatCurrency(stats.capital)}</h3>
           </div>
           <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2.5rem] flex items-center justify-between">
              <p className="text-[8px] font-black text-red-500 uppercase">Agotados: <span className="text-xl block">{stats.agotados}</span></p>
              <AlertCircle className="text-red-500/30"/>
           </div>
           <div className="md:col-span-2 bg-[#0A0A0A] border border-white/5 p-4 rounded-[2.5rem] flex items-center gap-4">
              <p className="text-[8px] font-black text-gray-500 uppercase ml-4">Generar Misión por:</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {proveedores.map(prov => (
                  <button key={prov.id} onClick={() => startMision(prov.id.toString())} className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border border-white/5">
                    {prov.nombre}
                  </button>
                ))}
              </div>
           </div>
        </div>

        {/* BUSCADOR & SCANNER */}
        <div className="flex gap-4 mb-10 sticky top-2 z-[50]">
          <div className="flex-1 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
            <input type="text" placeholder="BUSCAR SKU O PRODUCTO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-full py-5 pl-16 text-xs font-black uppercase outline-none focus:border-green-500" />
          </div>
          <button onClick={() => setShowScanner(true)} className="bg-green-600 text-white p-5 rounded-full shadow-2xl active:scale-90"><Camera size={24}/></button>
        </div>

        {/* LISTA DE ALMACÉN */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
            <div key={p.id} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px] hover:border-white/10 transition-all group">
              <div className="flex gap-4 items-start mb-6">
                <img src={p.url_imagen} className="w-16 h-16 rounded-2xl object-cover border border-white/5" />
                <div className="flex-1">
                  <h4 className="text-xs font-black uppercase text-white leading-tight">{p.nombre}</h4>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase italic">{p.proveedor_nombre || 'Abasto Central'}</p>
                </div>
                <button onClick={() => handleScanSuccess(p.sku)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10"><BarChart3 size={14}/></button>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black">
                  <span className="text-gray-500 uppercase">Stock</span>
                  <span className={p.stock_actual < 3 ? 'text-red-500' : 'text-green-500'}>{p.stock_actual} {p.unidad}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${p.stock_actual < 3 ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500 shadow-[0_0_8px_green]'}`} style={{ width: `${Math.min(100, (p.stock_actual / 10) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ MODAL DE FICHA RÁPIDA (CON HISTORIAL) */}
      {isEditing && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-8 w-full max-w-lg relative">
            <button onClick={() => setIsEditing(false)} className="absolute top-8 right-8 text-gray-500"><X/></button>
            <h3 className="text-2xl font-black uppercase italic mb-8 text-green-500">Radar de Producto</h3>
            
            <div className="space-y-6">
               <div className="flex gap-4 bg-black p-4 rounded-3xl border border-white/5">
                  <img src={formData.url_imagen} className="w-20 h-20 rounded-2xl object-cover" />
                  <div>
                    <p className="text-xl font-black uppercase leading-none">{formData.nombre}</p>
                    <p className="text-[9px] font-black text-gray-500 uppercase mt-2">SKU: {formData.sku}</p>
                  </div>
               </div>

               {/* 📉 HISTORIAL DE COSTOS (LO QUE PEDISTE) */}
               <div className="bg-white/[0.02] p-5 rounded-3xl border border-white/5">
                  <p className="text-[8px] font-black text-gray-400 uppercase mb-4 flex items-center gap-2"><History size={10}/> Historial de Costos Pagados</p>
                  <div className="space-y-3">
                    {costHistory.length > 0 ? costHistory.map((h, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] font-black border-b border-white/5 pb-2">
                        <span className="text-gray-500">{format(new Date(h.created_at), 'dd MMM yy')}</span>
                        <span className="text-white">{formatCurrency(h.costo_unitario)}</span>
                      </div>
                    )) : <p className="text-[10px] text-gray-600 italic">Sin historial de compras.</p>}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black p-5 rounded-3xl border border-white/5">
                    <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">Costo Actual</label>
                    <input type="number" value={formData.costo} onChange={e => setFormData({...formData, costo: parseFloat(e.target.value)})} className="w-full bg-transparent text-2xl font-black outline-none" />
                  </div>
                  <div className="bg-black p-5 rounded-3xl border border-white/5">
                    <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">Existencia</label>
                    <input type="number" value={formData.stock_actual} onChange={e => setFormData({...formData, stock_actual: parseFloat(e.target.value)})} className="w-full bg-transparent text-2xl font-black outline-none" />
                  </div>
               </div>

               <button onClick={async () => {
                 await supabase.from('productos').update({ costo: formData.costo, stock_actual: formData.stock_actual }).eq('id', formData.id);
                 setIsEditing(false); fetchInitialData();
               }} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] shadow-2xl">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      
      <button onClick={onBack} className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all">Volver al Inicio</button>
    </div>
  );
}
