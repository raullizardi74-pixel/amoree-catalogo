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
  const [loading, setLoading] = useState(false);

  const shippingCost = cartTotal > 0 && cartTotal < 100 ? 30 : 0;
  const total = cartTotal + shippingCost;

  const handleCheckout = async () => {
    if (user) {
      const orderDetails = {
        usuario_email: user.email,     // Cambiado: coincide con tu tabla
        detalle_pedido: cartItems,     // Cambiado: coincide con tu tabla
        total: total                   // Este se queda igual
        // Quitamos las fechas de entrega porque no tienes esas columnas en la tabla 'pedidos'
      };

      const { error } = await supabase.from('pedidos').insert([orderDetails]);
      if (error) {
        console.error('Error saving order:', error);
        alert('Hubo un error al guardar tu pedido. Por favor, inténtalo de nuevo.');
        return;
      }
    }

    const phoneNumber = '522215306435';
    let message = 'Hola! Quisiera hacer el siguiente pedido:\n\n';
    cartItems.forEach(item => {
      message += `${item.quantity} x ${item.Artículo} - ${formatCurrency(item['$ VENTA'] * item.quantity)}\n`;
    });
    message += `\nSubtotal: ${formatCurrency(cartTotal)}\n`;
    message += `Envío: ${formatCurrency(shippingCost)}\n`;
    message += `Total: ${formatCurrency(total)}\n`;
    message += `\nFecha de entrega: ${format(deliveryDate, 'PPP', { locale: es })}`;
    message += `\nHorario de entrega: ${deliveryTime}`;

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleRepeatLastOrder = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('detalle_pedido')          // Cambiado: era 'items'
        .eq('usuario_email', user.email)   // Cambiado: era 'user_email'
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (data && data.detalle_pedido) {   // Cambiado: era 'items'
        setCartItems(data.detalle_pedido); // Cambiado: era 'items'
      }
    } catch (error) {
      console.error('Error fetching last order:', error);
      alert('No se pudo recuperar tu último pedido.');
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = [];
  for (let i = 8; i <= 18; i++) {
    const hour = i.toString().padStart(2, '0');
    timeOptions.push(`${hour}:00`);
  }

  return (
    <div className="w-full lg:w-1/4 p-4 bg-white shadow-lg rounded-lg sticky top-24">
      <h2 className="text-2xl font-bold mb-4">Carrito</h2>
      {user && (
        <div className="mb-4">
          <button 
            onClick={handleRepeatLastOrder}
            disabled={loading}
            className="w-full bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Cargando...' : '#REPETIR MI ÚLTIMO PEDIDO'}
          </button>
        </div>
      )}
      {cartItems.length === 0 ? (
        <p>Tu carrito está vacío.</p>
      ) : (
        <>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {cartItems.map(item => (
              <div key={item.SKU} className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{item.Artículo}</p>
                  <p className="text-sm text-gray-500">{item.quantity} x {formatCurrency(item['$ VENTA'])}</p>
                </div>
                <div className='flex items-center gap-2'>
                    <p className='font-semibold'>{formatCurrency(item.quantity * item['$ VENTA'])}</p>
                    <button onClick={() => removeFromCart(item.SKU)} className='text-red-500 hover:text-red-700'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Envío</span>
              <span>{formatCurrency(shippingCost)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="delivery-date" className="block text-sm font-medium text-gray-700">Fecha de entrega</label>
              <DatePicker 
                selected={deliveryDate}
                onChange={(date: Date) => setDeliveryDate(date)}
                minDate={new Date()}
                dateFormat="P"
                locale="es"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>
            <div>
              <label htmlFor="delivery-time" className="block text-sm font-medium text-gray-700">Horario</label>
              <select 
                id="delivery-time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>
          <button 
            onClick={handleCheckout}
            className="w-full bg-green-500 text-white font-bold py-2 px-4 rounded mt-4 hover:bg-green-600 transition-colors"
          >
            Finalizar Compra por WhatsApp
          </button>
        </>
      )}
    </div>
  );
}
