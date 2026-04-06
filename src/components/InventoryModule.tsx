import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Scanner } from './Scanner';
import { 
  Camera, Save, ArrowLeft, Package, Truck, DollarSign, 
  BarChart3, UploadCloud, QrCode, Search, Filter, 
  AlertCircle, History, Plus, Minus, X, CheckCircle2, 
  ClipboardList, TrendingDown, Snowflake, ChevronRight
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';

export default function InventoryModule({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estatus de Filtros
  const [activeFilter, setActiveFilter] = useState<'todos' | 'agotado' | 'inversion'>('todos');
  const [selectedProviderId, setSelectedProviderId] = useState<string>('TODOS');
  
  const [activeView, setActiveView] = useState<'list' | 'mision'>('list');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre');
      const { data: prov } = await supabase.from('proveedores').select('*').order('nombre');
      // Traemos ventas de los últimos 7 días para el Radar de Liquidez
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

  // 🧠 CEREBRO DE ESTRATEGIA (Multifiltro + Radar de Liquidez)
  const processedProducts = useMemo(() => {
    const now = new Date();
    
    let list = products.map(p => {
      const capital = (p.stock_actual || 0) * (p.costo || 0);
      
      // Lógica de Movimiento
      const perecederos = ['FRUTAS', 'VERDURAS', 'CREMERÍA'];
      const diasLimite = perecederos.includes(p.categoria?.toUpperCase()) ? 3 : 7;
      const fechaLimite = subDays(now, diasLimite);
      
      const tieneVentaReciente = recentSales.some(s => {
        const items = Array.isArray(s.detalle_pedido) ? s.detalle_pedido : [];
        return items.some((i: any) => i.sku === p.sku) && isAfter(new Date(s.created_at), fechaLimite);
      });

      return { 
        ...p, 
        capital, 
        estancado: (p.stock_actual > 0 && !tieneVentaReciente) 
      };
    });

    // 1. Filtro por Proveedor
    if (selectedProviderId !== 'TODOS') {
      list = list.filter(p => p.proveedor_id?.toString() === selectedProviderId);
    }

    // 2. Filtro por Buscador
    if (searchTerm) {
      list = list.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm));
    }

    // 3. Filtro por KPI (Botones superiores)
    if (activeFilter === 'agotado') {
      list = list.filter(p => p.stock_actual <= 0);
    } else if (activeFilter === 'inversion') {
      // Ordenamos de mayor a menor capital
      list = list.sort((a, b) => b.capital - a.capital);
    }

    return list;
  }, [products, recentSales, selectedProviderId, searchTerm, activeFilter]);

  const stats = useMemo(() => {
    const capitalTotal = products.reduce((acc, p) => acc + ((p.stock_actual || 0) * (p.costo || 0)), 0);
    const agotados = products.filter(p => (p.stock_actual || 0) <= 0).length;
    return { capitalTotal, agotados };
  }, [products]);

  const handleScanSuccess = (sku: string) => {
    const found = products.find(p => p.sku === sku);
    if (found) {
      setFormData(found);
      setIsEditing(true);
    }
    setShowScanner(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 pb-40 animate-in fade-in">
      <div className="max-w-7xl mx-auto">
        
        {/* 1. INDICADORES ESTRATÉGICOS (BOTONES) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
           <button 
            onClick={() => setActiveFilter(activeFilter === 'inversion' ? 'todos' : 'inversion')}
            className={`p-6 rounded-[2.5rem] border transition-all flex flex-col justify-center relative overflow-hidden group ${
              activeFilter === 'inversion' ? 'bg-green-600 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10'
            }`}
           >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all"><DollarSign size={48}/></div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${activeFilter === 'inversion' ? 'text-green-200' : 'text-gray-500'}`}>Inversión en Bodega</p>
              <h3 className="text-3xl font-black italic">{formatCurrency(stats.capitalTotal)}</h3>
              {activeFilter === 'inversion' && <p className="text-[8px] font-bold mt-2 uppercase">Ordenado por mayor capital 📈</p>}
           </button>

           <button 
            onClick={() => setActiveFilter(activeFilter === 'agotado' ? 'todos' : 'agotado')}
            className={`p-6 rounded-[2.5rem] border transition-all flex items-center justify-between group ${
              activeFilter === 'agotado' ? 'bg-red-600 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-white/5 border-white/10'
            }`}
           >
              <div>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${activeFilter === 'agotado' ? 'text-red-200' : 'text-red-500'}`}>Agotados</p>
                <h3 className="text-3xl font-black">{stats.agotados} SKUs</h3>
              </div>
              <AlertCircle size={40} className={activeFilter === 'agotado' ? 'text-white' : 'text-red-500/30'}/>
           </button>
        </div>

        {/* 2. MULTIFILTRO: PROVEEDOR + BUSCADOR */}
        <div className="flex flex-col gap-4 mb-10 sticky top-2 z-[50]">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button 
              onClick={() => setSelectedProviderId('TODOS')}
              className={`px-6 py-3 rounded-full text-[9px] font-black uppercase border transition-all whitespace-nowrap ${selectedProviderId === 'TODOS' ? 'bg-white text-black border-white' : 'bg-black text-gray-500 border-white/10'}`}
            >
              Todos los Proveedores
            </button>
            {proveedores.map(prov => (
              <button 
                key={prov.id}
                onClick={() => setSelectedProviderId(prov.id.toString())}
                className={`px-6 py-3 rounded-full text-[9px] font-black uppercase border transition-all whitespace-nowrap ${selectedProviderId === prov.id.toString() ? 'bg-green-600 text-white border-green-500' : 'bg-black text-gray-500 border-white/10'}`}
              >
                {prov.nombre}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
              <input 
                type="text" 
                placeholder="BUSCAR EN ESTA VISTA..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full bg-black border border-white/10 rounded-full py-5 pl-16 text-xs font-black uppercase outline-none focus:border-green-500" 
              />
            </div>
            <button onClick={() => setShowScanner(true)} className="bg-green-600 text-white p-5 rounded-full shadow-2xl active:scale-90"><Camera size={24}/></button>
          </div>
        </div>

        {/* 3. LISTA DE PRODUCTOS DINÁMICA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedProducts.map(p => (
            <div key={p.id} className={`bg-[#0A0A0A] border rounded-[35px] p-6 transition-all group relative overflow-hidden ${p.estancado ? 'border-blue-500/30' : 'border-white/5'}`}>
              
              {/* Radar de Liquidez: Copo de nieve para estancados */}
              {p.estancado && (
                <div className="absolute top-4 right-4 text-blue-500 flex items-center gap-1 animate-pulse">
                  <Snowflake size={14}/> <span className="text-[7px] font-black uppercase">Capital Congelado</span>
                </div>
              )}

              <div className="flex gap-4 items-start mb-6">
                <img src={p.url_imagen} className="w-16 h-16 rounded-2xl object-cover border border-white/5" />
                <div className="flex-1">
                  <p className="text-[7px] font-black text-gray-600 uppercase mb-1">{p.categoria}</p>
                  <h4 className="text-xs font-black uppercase text-white leading-tight group-hover:text-green-500 transition-colors">{p.nombre}</h4>
                  
                  {/* Visualización de Capital (Lo que pediste) */}
                  {activeFilter === 'inversion' && (
                    <p className="text-[10px] font-black text-green-500 mt-2 bg-green-500/10 px-2 py-1 rounded-lg inline-block">
                      CAPITAL: {formatCurrency(p.capital)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black">
                  <span className="text-gray-500 uppercase">Existencia Real</span>
                  <span className={p.stock_actual < 3 ? 'text-red-500' : 'text-green-500'}>{p.stock_actual} {p.unidad}</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${p.stock_actual < 3 ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-green-500 shadow-[0_0_8px_green]'}`} 
                    style={{ width: `${Math.min(100, (p.stock_actual / 10) * 100)}%` }} 
                  />
                </div>

                <div className="flex gap-2">
                   <button onClick={() => { setFormData(p); setIsEditing(true); }} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-white/5 transition-all">Ver Ficha</button>
                   {selectedProviderId !== 'TODOS' && p.stock_actual < 5 && (
                     <button className="px-4 bg-orange-600 text-white rounded-2xl active:scale-95"><Plus size={14}/></button>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER DE MISIÓN (Se activa al filtrar por proveedor) */}
      {selectedProviderId !== 'TODOS' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-black px-10 py-5 rounded-full flex items-center gap-4 shadow-[0_20px_50px_rgba(255,255,255,0.2)] z-[1000] active:scale-95 transition-all cursor-pointer">
          <ClipboardList size={20}/>
          <div className="flex flex-col">
            <span className="text-[7px] font-black uppercase opacity-50">Generar Misión</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Surtir {proveedores.find(pr => pr.id.toString() === selectedProviderId)?.nombre}</span>
          </div>
          <ChevronRight size={18}/>
        </div>
      )}

      {/* MODAL DE SCANNER */}
      {showScanner && <Scanner onScanSuccess={handleScanSuccess} onClose={() => setShowScanner(false)} />}
      
      {/* BOTÓN VOLVER AL INICIO */}
      <button onClick={onBack} className="fixed bottom-8 left-6 bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl active:scale-95 transition-all">
        <ArrowLeft size={20}/>
      </button>

    </div>
  );
}
