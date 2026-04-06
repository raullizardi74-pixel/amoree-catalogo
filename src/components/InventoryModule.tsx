import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { 
  Camera, Save, ArrowLeft, Package, Truck, DollarSign, 
  BarChart3, UploadCloud, QrCode, Search, Filter, 
  AlertCircle, History, Plus, Minus, X, CheckCircle2, 
  ClipboardList, TrendingDown, Snowflake, ChevronRight, Wallet
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';

export default function InventoryModule({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [activeFilter, setActiveFilter] = useState<'todos' | 'agotado' | 'inversion'>('todos');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('TODOS');
  const [activeView, setActiveView] = useState<'list' | 'mision'>('list');
  
  const [isEditing, setIsEditing] = useState(false);
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [misionItems, setMisionItems] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre');
      const { data: prov } = await supabase.from('proveedores').select('*').order('nombre');
      const { data: sales } = await supabase.from('pedidos')
        .select('detalle_pedido, created_at')
        .eq('estado', 'Finalizado')
        .gte('created_at', subDays(new Date(), 7).toISOString());

      if (p) setProducts(p);
      if (prov) setProveedores(prov);
      if (sales) setRecentSales(sales);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchHistory = async (sku: string) => {
    const { data } = await supabase.from('compras_detalle')
      .select('costo_unitario, created_at')
      .eq('sku', sku).order('created_at', { ascending: false }).limit(3);
    setCostHistory(data || []);
  };

  const openProductSheet = (product: any) => {
    setFormData({ ...product });
    fetchHistory(product.sku);
    setIsEditing(true);
  };

  const handleScanSuccess = (sku: string) => {
    const found = products.find(p => p.sku === sku);
    if (found) {
      openProductSheet(found);
    } else {
      setFormData({ sku, nombre: '', costo: 0, stock_actual: 0 });
      setCostHistory([]);
      setIsEditing(true);
    }
    setShowScanner(false);
  };

  const startMision = (provId: string) => {
    const items = products.filter(p => {
      const matchProv = provId === 'TODOS' || p.proveedor_id?.toString() === provId;
      return matchProv && (p.stock_actual || 0) < 5;
    }).map(p => ({
      ...p,
      cantidad_a_comprar: Number(Math.max(0, 10 - (p.stock_actual || 0)).toFixed(3)),
      costo_ajustado: p.costo || 0
    }));

    if (items.length === 0) return alert("Socio, el stock está saludable.");
    setMisionItems(items);
    setActiveView('mision');
  };

  const processedProducts = useMemo(() => {
    const now = new Date();
    let list = products.map(p => {
      const capital = Number(((p.stock_actual || 0) * (p.costo || 0)).toFixed(2));
      const perecederos = ['FRUTAS', 'VERDURAS', 'CREMERÍA'];
      const diasLimite = perecederos.includes(p.categoria?.toUpperCase()) ? 3 : 7;
      const tieneVentaReciente = recentSales.some(s => {
        const items = Array.isArray(s.detalle_pedido) ? s.detalle_pedido : [];
        return items.some((i: any) => i.sku === p.sku) && isAfter(new Date(s.created_at), subDays(now, diasLimite));
      });
      return { ...p, capital, estancado: (p.stock_actual > 0 && !tieneVentaReciente) };
    });

    if (selectedProviderId !== 'TODOS') list = list.filter(p => p.proveedor_id?.toString() === selectedProviderId);
    if (searchTerm) list = list.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm));
    if (activeFilter === 'agotado') list = list.filter(p => p.stock_actual <= 0);
    else if (activeFilter === 'inversion') list = list.sort((a, b) => b.capital - a.capital);

    return list;
  }, [products, recentSales, selectedProviderId, searchTerm, activeFilter]);

  const totalsMision = useMemo(() => {
    const neto = misionItems.reduce((acc, i) => acc + (i.cantidad_a_comprar * i.costo_ajustado), 0);
    return { neto, totalConBuffer: Number((neto * 1.10).toFixed(2)) };
  }, [misionItems]);

  const stats = useMemo(() => {
    const capitalTotal = products.reduce((acc, p) => acc + ((p.stock_actual || 0) * (p.costo || 0)), 0);
    const agotados = products.filter(p => (p.stock_actual || 0) <= 0).length;
    return { capitalTotal, agotados };
  }, [products]);

  // ✅ VISTA DE MISIÓN (CHECKLIST)
  if (activeView === 'mision') {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-6 pb-64 animate-in slide-in-from-bottom duration-500">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <button onClick={() => setActiveView('list')} className="bg-white/5 p-4 rounded-2xl"><ArrowLeft/></button>
            <h2 className="text-2xl font-black uppercase italic text-green-500">Misión de Abasto</h2>
            <div className="w-12"></div>
          </div>

          <div className="bg-green-600/10 border border-green-500/20 p-8 rounded-[40px] mb-8 text-center">
            <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em] mb-2">Efectivo a llevar (+10% Buffer)</p>
            <h3 className="text-5xl font-black italic text-white">{formatCurrency(totalsMision.totalConBuffer)}</h3>
          </div>

          <div className="space-y-4">
            {misionItems.map((item, idx) => (
              <div key={item.id} className="bg-[#0A0A0A] border border-white/5 p-6 rounded-[35px] flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1">
                  <h4 className="text-lg font-black uppercase italic leading-none">{item.nombre}</h4>
                  <p className="text-[9px] font-bold text-gray-500 mt-2 uppercase tracking-widest">STOCK: {Number(item.stock_actual.toFixed(3))} {item.unidad}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                  <div className="bg-black p-4 rounded-2xl border border-white/5">
                    <label className="text-[7px] text-gray-500 font-black uppercase block mb-1">Pedir</label>
                    <input type="number" value={item.cantidad_a_comprar} onChange={(e) => {
                      const n = [...misionItems]; n[idx].cantidad_a_comprar = parseFloat(e.target.value) || 0; setMisionItems(n);
                    }} className="bg-transparent text-xl font-black text-green-500 outline-none w-20" />
                  </div>
                  <div className="bg-black p-4 rounded-2xl border border-white/5">
                    <label className="text-[7px] text-gray-500 font-black uppercase block mb-1">Costo Unit.</label>
                    <input type="number" value={item.costo_ajustado} onChange={(e) => {
                      const n = [...misionItems]; n[idx].costo_ajustado = parseFloat(e.target.value) || 0; setMisionItems(n);
                    }} className="bg-transparent text-xl font-black text-white outline-none w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-8 bg-black/90 backdrop-blur-xl border-t border-white/10 z-[100]">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-4">
            <div className="flex-1 bg-white/5 p-4 rounded-3xl border border-white/10 flex justify-between items-center px-8">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Total Neto:</p>
              <p className="text-2xl font-black">{formatCurrency(totalsMision.neto)}</p>
            </div>
            <button onClick={() => alert("REGISTRANDO COMPRA EN BBDD...")} className="flex-[2] bg-white text-black py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs active:scale-95 transition-all shadow-2xl">
              Confirmar y Registrar Gasto en Caja 🚀
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 pb-40 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto">
        
        {/* INDICADORES ESTRATÉGICOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button onClick={() => setActiveFilter(activeFilter === 'inversion' ? 'todos' : 'inversion')} className={`p-6 rounded-[2.5rem] border transition-all text-left relative overflow-hidden group ${activeFilter === 'inversion' ? 'bg-green-600 border-green-400 shadow-2xl' : 'bg-white/5 border-white/10'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all"><DollarSign size={48}/></div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50 text-white">Inversión Total</p>
            <h3 className="text-3xl font-black italic">{formatCurrency(stats.capitalTotal)}</h3>
          </button>
          <button onClick={() => setActiveFilter(activeFilter === 'agotado' ? 'todos' : 'agotado')} className={`p-6 rounded-[2.5rem] border transition-all text-left flex items-center justify-between group ${activeFilter === 'agotado' ? 'bg-red-600 border-red-400 shadow-2xl' : 'bg-white/5 border-white/10'}`}>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50 text-white">Agotados</p>
              <h3 className="text-3xl font-black">{stats.agotados} SKUs</h3>
            </div>
            <AlertCircle size={40} className="text-red-500/30"/>
          </button>
        </div>

        {/* MULTIFILTRO */}
        <div className="flex flex-col gap-4 mb-10 sticky top-2 z-[50]">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button onClick={() => setSelectedProviderId('TODOS')} className={`px-6 py-3 rounded-full text-[9px] font-black uppercase border transition-all whitespace-nowrap ${selectedProviderId === 'TODOS' ? 'bg-white text-black' : 'bg-black text-gray-500 border-white/10'}`}>Todos los Proveedores</button>
            {proveedores.map(prov => (
              <button key={prov.id} onClick={() => setSelectedProviderId(prov.id.toString())} className={`px-6 py-3 rounded-full text-[9px] font-black uppercase border transition-all whitespace-nowrap ${selectedProviderId === prov.id.toString() ? 'bg-green-600 text-white border-green-500' : 'bg-black text-gray-500 border-white/10'}`}>{prov.nombre}</button>
            ))}
          </div>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
              <input type="text" placeholder="BUSCAR PRODUCTO O SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-black border border-white/10 rounded-full py-5 pl-16 text-xs font-black uppercase outline-none focus:border-green-500 shadow-2xl" />
            </div>
            <button onClick={() => setShowScanner(true)} className="bg-green-600 text-white p-5 rounded-full shadow-2xl active:scale-90"><Camera size={24}/></button>
          </div>
        </div>

        {/* LISTA DE PRODUCTOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedProducts.map(p => (
            <div key={p.id} className={`bg-[#0A0A0A] border rounded-[35px] p-6 transition-all relative overflow-hidden ${p.estancado ? 'border-blue-500/30' : 'border-white/5'}`}>
              {p.estancado && <div className="absolute top-4 right-4 text-blue-500 animate-pulse"><Snowflake size={14}/></div>}
              <div className="flex gap-4 items-start mb-6">
                <img src={p.url_imagen} className="w-16 h-16 rounded-2xl object-cover border border-white/5" />
                <div className="flex-1">
                  <p className="text-[7px] font-black text-gray-600 uppercase mb-1">{p.categoria}</p>
                  <h4 className="text-xs font-black uppercase text-white leading-tight">{p.nombre}</h4>
                  {activeFilter === 'inversion' && <p className="text-[10px] font-black text-green-500 mt-2 bg-green-500/10 px-2 py-1 rounded-lg inline-block">CAPITAL: {formatCurrency(p.capital)}</p>}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${p.stock_actual < 3 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (p.stock_actual / 10) * 100)}%` }} />
                </div>
                <button onClick={() => openProductSheet(p)} className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">Ver Ficha de Producto</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ BOTÓN DE MISIÓN FLOTANTE */}
      {selectedProviderId !== 'TODOS' && (
        <div 
          onClick={() => startMision(selectedProviderId)}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-black px-10 py-5 rounded-full flex items-center gap-4 shadow-[0_20px_50px_rgba(255,255,255,0.4)] z-[1000] active:scale-95 transition-all cursor-pointer border-4 border-green-500"
        >
          <ClipboardList size={24}/>
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase opacity-50">Generar Misión</span>
            <span className="text-[11px] font-black uppercase tracking-widest italic">Surtir {proveedores.find(pr => pr.id.toString() === selectedProviderId)?.nombre}</span>
          </div>
          <ChevronRight size={20}/>
        </div>
      )}

      {/* ✅ MODAL RADAR PRO (RESTURADO COMPLETO) */}
      {isEditing && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
           <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-8 w-full max-w-lg relative animate-in zoom-in duration-300">
              <button onClick={() => setIsEditing(false)} className="absolute top-8 right-8 text-gray-500"><X/></button>
              <h3 className="text-2xl font-black uppercase italic mb-8 text-green-500">Radar de Producto</h3>
              
              <div className="space-y-6">
                 {/* FOTO Y NOMBRE */}
                 <div className="flex gap-4 bg-black p-4 rounded-3xl border border-white/5">
                    <img src={formData.url_imagen} className="w-20 h-20 rounded-2xl object-cover" />
                    <div>
                      <p className="text-xl font-black uppercase leading-none">{formData.nombre}</p>
                      <p className="text-[9px] font-black text-gray-500 uppercase mt-2 tracking-widest italic">SKU: {formData.sku}</p>
                    </div>
                 </div>

                 {/* 📈 HISTORIAL DE COSTOS */}
                 <div className="bg-white/[0.02] p-5 rounded-3xl border border-white/5">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-4 flex items-center gap-2 tracking-widest">
                      <History size={10} className="text-green-500"/> Historial de Costos Pagados
                    </p>
                    <div className="space-y-3">
                      {costHistory.length > 0 ? costHistory.map((h, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px] font-black border-b border-white/5 pb-2">
                          <span className="text-gray-500">{format(new Date(h.created_at), 'dd MMM yy')}</span>
                          <span className="text-white">{formatCurrency(h.costo_unitario)}</span>
                        </div>
                      )) : <p className="text-[10px] text-gray-600 italic">Sin historial de compras registrado.</p>}
                    </div>
                 </div>

                 {/* EDICIÓN RÁPIDA */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black p-5 rounded-3xl border border-white/5 shadow-inner">
                      <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">Costo Actual</label>
                      <input 
                        type="number" 
                        value={formData.costo} 
                        onChange={e => setFormData({...formData, costo: parseFloat(e.target.value)})} 
                        className="w-full bg-transparent text-2xl font-black text-white outline-none" 
                      />
                    </div>
                    <div className="bg-black p-5 rounded-3xl border border-white/5 shadow-inner">
                      <label className="text-[8px] font-black text-gray-500 uppercase block mb-1">Stock Actual</label>
                      <input 
                        type="number" 
                        value={formData.stock_actual} 
                        onChange={e => setFormData({...formData, stock_actual: parseFloat(e.target.value)})} 
                        className="w-full bg-transparent text-2xl font-black text-green-500 outline-none" 
                      />
                    </div>
                 </div>

                 {/* ACCIÓN */}
                 <button 
                  onClick={async () => {
                    const { error } = await supabase.from('productos').update({ costo: formData.costo, stock_actual: formData.stock_actual }).eq('id', formData.id);
                    if (!error) { setIsEditing(false); fetchInitialData(); }
                  }} 
                  className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-2xl"
                 >
                   Guardar Cambios Titanium
                 </button>
              </div>
           </div>
        </div>
      )}

      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      <button onClick={onBack} className="fixed bottom-8 left-6 bg-black/80 border border-white/10 p-4 rounded-2xl active:scale-95 transition-all"><ArrowLeft size={20}/></button>
    </div>
  );
}
