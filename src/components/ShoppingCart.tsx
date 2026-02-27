import { useState } from 'react';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import DatePicker, { registerLocale } from 'react-datepicker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

registerLocale('es', es);

export default function ShoppingCart() {
  const { cartItems, cartTotal, removeFromCart, setCartItems } = useShoppingCart();
  const { user } = useAuth();
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  
  // 1. NUEVO ESTADO PARA EL TELÉFONO
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const shippingCost = cartTotal > 0 && cartTotal < 100 ? 30 : 0;
  const total = cartTotal + shippingCost;

  const handleCheckout = async () => {
    // Validación básica: Hugo necesita el teléfono sí o sí
    if (!phone || phone.length < 10) {
      alert('Por favor, ingresa un número de teléfono válido para que Hugo y Rosi puedan contactarte.');
      return;
    }

    const clienteNombre = user?.user_metadata?.full_name || user?.email || 'Cliente';

    if (user) {
      const orderDetails = {
        usuario_email: user.email,
        detalle_pedido: cartItems,
        total: total,
        // 3. GUARDAMOS EL TELÉFONO EN LA NUEVA COLUMNA
        telefono_cliente: phone 
      };
      
      const { error } = await supabase.from('pedidos').insert([orderDetails]);
      if (error) {
        console.error('Error saving order:', error);
        alert('Hubo un error al guardar tu pedido.');
        return;
      }
    }

    const phoneNumber = '522215306435';
// MENSAJE PERSONALIZADO PARA HUGO Y ROSI (Corregido con Emojis estándar)
    let message = `🛒 *NUEVO PEDIDO - AMOREE*\n`;
    message += `👤 *Cliente:* ${clienteNombre}\n`;
    message += `📞 *Tel:* ${phone}\n`;
    message += `--------------------------\n\n`;
    
    cartItems.forEach(item => {
      const unidad = item.unidad || '';
      // Usamos un punto estándar para evitar errores de símbolos
      message += `• ${item.quantity} ${unidad} x ${item.nombre} - ${formatCurrency(item.precio_venta * item.quantity)}\n`;
    });

    message += `\n--------------------------\n`;
    message += `💰 *Subtotal Estimado:* ${formatCurrency(cartTotal)}\n`;
    message += `🚚 *Envío:* ${formatCurrency(shippingCost)}\n`;
    message += `🧾 *TOTAL APROXIMADO:* ${formatCurrency(total)}\n\n`;
    message += `📅 *Entrega:* ${format(deliveryDate, 'PPP', { locale: es })} a las ${deliveryTime}\n\n`;
    message += `⚠️ _Nota: Amoree confirmará el peso real en báscula antes de enviar._`;

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleRepeatLastOrder = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: lastOrder } = await supabase
        .from('pedidos')
        .select('detalle_pedido, telefono_cliente')
        .eq('usuario_email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastOrder) {
        // Autocompletamos el teléfono del último pedido
        if (lastOrder.telefono_cliente) setPhone(lastOrder.telefono_cliente);

        const { data: currentProducts } = await supabase
          .from('productos')
          .select('sku, nombre, precio_venta, unidad');

        const updatedCart = lastOrder.detalle_pedido.map((oldItem: any) => {
          const currentProduct = currentProducts?.find(p => p.sku === (oldItem.sku || oldItem.SKU));
          return {
            sku: currentProduct ? currentProduct.sku : (oldItem.sku || oldItem.SKU),
            nombre: currentProduct ? currentProduct.nombre : (oldItem.nombre || oldItem.Artículo),
            precio_venta: currentProduct ? currentProduct.precio_venta : (oldItem.precio_venta || oldItem['$ VENTA']),
            unidad: currentProduct ? currentProduct.unidad : (oldItem.unidad || ''),
            quantity: oldItem.quantity
          };
        });
        setCartItems(updatedCart);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-1/4 p-4 bg-white shadow-lg rounded-lg sticky top-24">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center border-b pb-2">Tu Carrito</h2>
      {user && (
        <button onClick={handleRepeatLastOrder} disabled={loading} className="w-full bg-green-500 text-white font-bold py-2 px-4 rounded mb-6 hover:bg-green-600 transition-colors shadow-sm">
          {loading ? 'Cargando...' : '#REPETIR MI ÚLTIMO PEDIDO'}
        </button>
      )}
      
      {cartItems.length === 0 ? (
        <p className="text-gray-500 italic text-center py-10">Agrega productos frescos para comenzar.</p>
      ) : (
        <>
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2 mb-6">
            {cartItems.map(item => (
              <div key={item.sku} className="flex justify-between items-start border-b border-gray-50 pb-2">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                  <p className="text-[11px] text-gray-500">{item.quantity} {item.unidad} x {formatCurrency(item.precio_venta)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-700 text-sm">{formatCurrency(item.quantity * item.precio_venta)}</p>
                  <button onClick={() => removeFromCart(item.sku)} className="text-red-300 hover:text-red-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 2. DISEÑO DEL CAMPO DE TELÉFONO */}
          <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">WhatsApp de contacto</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-sm">🇲🇽</span>
              <input 
                type="tel"
                placeholder="Tu número a 10 dígitos"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Fecha Entrega</label>
              <DatePicker selected={deliveryDate} onChange={(date: Date) => setDeliveryDate(date)} minDate={new Date()} dateFormat="P" locale="es" className="w-full text-xs border-gray-300 rounded-md mt-1" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Horario</label>
              <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full text-xs border-gray-300 rounded-md mt-1">
                {Array.from({length: 11}, (_, i) => i + 8).map(h => {
                  const time = `${h.toString().padStart(2, '0')}:00`;
                  return <option key={time} value={time}>{time}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t-2 border-dashed border-gray-100 space-y-1">
            <div className="flex justify-between text-gray-600 text-sm font-medium">
              <span>Subtotal Estimado</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between font-black text-lg text-green-800">
              <span>TOTAL APROX.</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <p className="text-[9px] text-gray-400 italic text-center mt-2 leading-tight">
              * Hugo y Rosi confirmarán el peso real antes del envío.
            </p>
          </div>

          <button onClick={handleCheckout} className="w-full bg-green-600 text-white font-extrabold py-3 px-4 rounded-xl mt-4 hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Finalizar Compra
          </button>
        </>
      )}
    </div>
  );
}
