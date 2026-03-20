import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import Dashboard from './Dashboard';
import POS from './POS';
import ClientsModule from './ClientsModule';
import RutaDeCompra from './RutaDeCompra';
import InventoryModule from './InventoryModule'; 
import ReciboModule from './ReciboModule'; // ✅ PUNTO 1: Importación del nuevo módulo
import { Scanner } from './Scanner';
import { format } from 'date-fns';
import { Package, LayoutDashboard, ShoppingBag, Users, BarChart3, Truck, Calculator, X } from 'lucide-react';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ PUNTO 1 (BIS): Agregamos 'recibo' al tipo de estado de la vista
  const [view, setView] = useState<'orders' | 'stats' | 'pos' | 'clients' | 'ruta' | 'inventory' | 'recibo'>('orders');
  
  const [orderTab, setOrderTab] = useState<'whatsapp' | 'terminal' | 'pagos'>('whatsapp');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- ESTADOS PARA CORTE DE CAJA ---
  const [showCorteModal, setShowCorteModal] = useState(false);
  const [corteSummary, setCorteSummary] = useState<any>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const sendWA = (telefono: string, mensaje: string) => {
    const cleanTel = telefono.match(/(\d{10})/)?.[1];
    if (cleanTel) {
      window.open(`https://wa.me/52${cleanTel}?text=${encodeURIComponent(mensaje)}`, '_blank');
    }
  };

  const discountStock = async (items: any[]) => {
    for (const item of items) {
      const { data: product } = await supabase
        .from('productos')
        .select('stock_actual')
        .eq('sku', item.sku || item.SKU)
        .single();

      if (product) {
        const nuevoStock = product.stock_actual - item.quantity;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('sku', item.sku || item.SKU);
      }
    }
  };

  // --- 🔄 GESTOR DE ESTADOS LÓGICOS ---
  const handleConfirmWeights = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ 
      estado: 'Pendiente de Pago',
      detalle_pedido: order.detalle_pedido,
      total: order.total 
    }).eq('id', order.id);

    if (!error) {
      const msg = `*AMOREE - Pesos Confirmados* 🥑\n\n¡Hola! Ya pesamos tu pedido:\n` +
                  order.detalle_pedido.map((i:any) => `- ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`).join('\n') +
                  `\n\n*TOTAL FINAL: ${formatCurrency(order.total)}*\n\nFavor de enviar comprobante. 🚀`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleRegisterPayment = async (order: any, metodo: string) => {
    if (metodo === 'A Cuenta') {
      const { data: client } = await supabase.from('clientes').select('*').eq('telefono', order.telefono_cliente).single();
      if (client) {
        await supabase.from('clientes').update({ saldo_deudor: (client.saldo_deudor || 0) + order.total }).eq('id', client.id);
      } else {
        await supabase.from('clientes').insert([{ nombre: order.nombre_cliente.toUpperCase(), telefono: order.telefono_cliente, saldo_deudor: order.total }]);
      }
    }

    const { error } = await supabase.from('pedidos').update({ estado: 'Pagado - Por Entregar', metodo_pago: metodo }).eq('id', order.id);
    if (!error) {
      const msg = metodo === 'A Cuenta' 
        ? `*AMOREE - Crédito Registrado* 📑\n\nPedido por *${formatCurrency(order.total)}* registrado A CUENTA.\n\nEntrega PROGRAMADA. 🛵`
        : `*AMOREE - Pago Recibido* ✅\n\nConfirmamos pago por *${formatCurrency(order.total)}* vía *${metodo}*.\n\nEntrega PROGRAMADA. 🛵`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  const handleDeliver = async (order: any) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('id', order.id);
    if (!error) {
      await discountStock(order.detalle_pedido);
      const msg = `*AMOREE - Pedido Entregado* 📦\n\n¡Tu pedido ha llegado! Gracias por tu confianza. 🥑✨`;
      sendWA(order.telefono_cliente, msg);
      fetchOrders();
    }
  };

  // --- 🏦 MOTOR DE CORTE DE CAJA ---
  const prepararCorte = () => {
    const hoy = new Date().toLocaleDateString();
    const ventasHoy = orders.filter(o => 
      new Date(o.created_at).toLocaleDateString() === hoy && 
      o.estado !== 'Cancelado'
    );

    const resumen = ventasHoy.reduce((acc, o) => {
      const metodo = o.metodo_pago || 'Efectivo';
      acc[metodo] = (acc[metodo] || 0) + o.total;
      acc['Total'] = (acc['Total'] || 0) + o.total;
      return acc;
    }, { 'Efectivo': 0, 'Transferencia': 0, 'Terminal': 0, 'A Cuenta': 0, 'Total': 0 } as any);

    setCorteSummary({ ...resumen, cantidad: ventasHoy.length });
    setShowCorteModal(true);
  };

  const enviarCorteWA = () => {
    const fecha = format(new Date(), 'dd/MM/yyyy');
    let msg = `*AMOREE - CORTE DE CAJA* 🏦\n*Fecha:* ${fecha}\n--------------------------\n`;
    msg += `💵 Efectivo: *${formatCurrency(corteSummary.Efectivo)}*\n🏦 Transf: *${formatCurrency(corteSummary.Transferencia)}*\n`;
    msg += `💳 Terminal: *${formatCurrency(corteSummary.Terminal)}*\n📑 A Cuenta: *${formatCurrency(corteSummary['A Cuenta'])}*\n--------------------------\n`;
    msg += `💰 *TOTAL DÍA: ${formatCurrency(corteSummary.Total)}*\n📦 Pedidos: ${corteSummary.cantidad}\n\n🚀 *Automatiza con Raul*`;

    sendWA("52XXXXXXXXXX", msg); // Configurar cel del dueño
    setShowCorteModal(false);
  };

  const getFilteredOrders = () => {
    let filtered = [...orders];
    if (orderTab === 'whatsapp') filtered = filtered.filter(o => o.origen !== 'Mostrador' && !o.telefono_cliente?.includes('ABONO'));
    else if (orderTab === 'terminal') filtered = filtered.filter(o => o.origen === 'Mostrador');
    if (searchTerm) filtered = filtered.filter(o => (o.nombre_cliente || '').toLowerCase().includes(searchTerm.toLowerCase()));
    return filtered;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-32">
      {/* HEADER DE NAVEGACIÓN TITANIUM */}
      <div className
