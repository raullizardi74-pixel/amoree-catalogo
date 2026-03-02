import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { startOfDay, endOfDay, subDays, isWithinInterval, format } from 'date-fns';
import { es } from 'date-fns/locale/es';

interface ProductStats {
  nombre: string;
  cantidad: number;
  ventaTotal: number;
  costoTotal: number;
  utilidad: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7'); // Días a mostrar
  const [stats, setStats] = useState({
    ventaTotal: 0,
    costoTotal: 0,
    utilidad: 0,
    numPedidos: 0,
    ticketPromedio: 0,
    margenPorcentaje: 0
  });
  const [topProducts, setTopProducts] = useState<ProductStats[]>([]);

  useEffect(() => {
    fetchData();
  }, [periodo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .in('estado', ['Pagado - Por Entregar', 'Finalizado']);

      if (error) throw error;

      const ahora = new Date();
      const inicio = startOfDay(subDays(ahora, parseInt(periodo)));
      const fin = endOfDay(ahora);

      const pedidosFiltrados = pedidos.filter(p => 
        isWithinInterval(new Date(p.created_at), { start: inicio, end: fin })
      );

      // --- CÁLCULOS GENERALES ---
      let v = 0, c = 0, n = 0;
      const productMap = new Map<string, ProductStats>();

      pedidosFiltrados.forEach(p => {
        v += p.total;
        n++;
        p.detalle_pedido?.forEach((item: any) => {
          const costoUnitario = item.costo || 0;
          const itemCostoTotal = costoUnitario * item.quantity;
          const itemVentaTotal = item.precio_venta * item.quantity;
          c += itemCostoTotal;

          // Agrupar por producto para el Top 5
          const current = productMap.get(item.nombre) || { 
            nombre: item.nombre, cantidad: 0, ventaTotal: 0, costoTotal: 0, utilidad: 0 
          };
          current.cantidad += item.quantity;
          current.ventaTotal += itemVentaTotal;
          current.costoTotal += itemCostoTotal;
          current.utilidad += (itemVentaTotal - itemCostoTotal);
          productMap.set(item.nombre, current);
        });
      });

      setStats({
        ventaTotal: v,
        costoTotal: c,
        utilidad: v - c,
        numPedidos: n,
        ticketPromedio: n > 0 ? v / n : 0,
        margenPorcentaje: v > 0 ? ((v - c) / v) * 100 : 0
      });

      // Ordenar y sacar los 5 mejores
      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.utilidad - a.utilidad)
        .slice(0, 5);
      setTopProducts(sortedProducts);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
      <p className="font-black text-green-800 text-xs uppercase tracking-[0.3em]">Analizando Finanzas...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        
        {/* SELECTOR DE PERIODO */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Panel de <span className="text-green-600">Resultados</span></h2>
          <div className="flex bg-white rounded-2xl p-1 shadow-sm border">
            {[
              { l: 'Hoy', v: '0' },
              { l: '7D', v: '7' },
              { l: '30D', v: '30' }
            ].map((btn) => (
              <button
                key={btn.v}
                onClick={() => setPeriodo(btn.v)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                  periodo === btn.v ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                {btn.l}
              </button>
            ))}
          </div>
        </div>

        {/* TARJETAS KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl font-black italic">VENTA</div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ventas Totales</p>
              <p className="text-3xl font-black text-gray-900">{formatCurrency(stats.ventaTotal)}</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-1 rounded-lg font-black">{stats.numPedidos} PEDIDOS</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl font-black italic">COSTO</div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Inversión Mercancía</p>
            <p className="text-3xl font-black text-gray-700">{formatCurrency(stats.costoTotal)}</p>
            <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-400" 
                style={{ width: `${(stats.costoTotal / stats.ventaTotal) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-green-600 p-6 rounded-[2.5rem] shadow-xl shadow-green-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl font-black italic text-white">PROFIT</div>
            <p className="text-[10px] font-black text-green-200 uppercase tracking-widest mb-1">Utilidad Neta</p>
            <p className="text-3xl font-black text-white">{formatCurrency(stats.utilidad)}</p>
            <div className="mt-4">
              <span className="text-white font-black text-xs">+{stats.margenPorcentaje.toFixed(1)}% de Margen</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* TOP PRODUCTOS (Comportamiento de artículos) */}
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
            <h3 className="font-black text-gray-900 uppercase italic mb-6 flex items-center gap-2">
              🏆 Top 5 Productos <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg not-italic">Más Rentables</span>
            </h3>
            <div className="space-y-6">
              {topProducts.map((prod, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-end mb-2">
                    <p className="font-black text-sm text-gray-800 uppercase tracking-tighter">{prod.nombre}</p>
                    <p className="font-black text-xs text-green-600">{formatCurrency(prod.utilidad)}</p>
                  </div>
                  <div className="w-full h-3 bg-gray-50 rounded-full flex overflow-hidden">
                    {/* Barra de Costo vs Venta */}
                    <div 
                      className="bg-gray-200 h-full border-r border-white" 
                      style={{ width: `${(prod.costoTotal / prod.ventaTotal) * 100}%` }}
                    ></div>
                    <div 
                      className="bg-green-500 h-full" 
                      style={{ width: `${(prod.utilidad / prod.ventaTotal) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 opacity-40 text-[8px] font-bold uppercase">
                    <span>Inversión</span>
                    <span>Ganancia</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* OTRAS MÉTRICAS */}
          <div className="flex flex-col gap-6">
            <div className="bg-gray-900 p-8 rounded-[3rem] text-white flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ticket Promedio</p>
              <p className="text-4xl font-black tracking-tighter italic">{formatCurrency(stats.ticketPromedio)}</p>
              <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                Cada cliente te compra esta cantidad en promedio. <br />
                ¡Sugerencia: Ofrece combos para subir esta cifra!
              </p>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
              <h3 className="font-black text-gray-900 uppercase italic mb-4">Eficiencia de Amoree</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Pedidos Procesados</span>
                    <span className="font-black text-gray-900 text-lg">{stats.numPedidos}</span>
                 </div>
                 <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Tiempo de Gestión</span>
                    <span className="font-black text-green-600 text-sm">Automático</span>
                 </div>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER DE VALOR */}
        <p className="text-center mt-12 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          Generado por Inteligencia Amoree • Tu negocio en control total
        </p>

      </div>
    </div>
  );
}
