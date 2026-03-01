import { useState, useEffect } from 'react';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import DatePicker, { registerLocale } from 'react-datepicker';
import { format, addMinutes, isSameDay, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

registerLocale('es', es);

export default function ShoppingCart() {
  const { cartItems, cartTotal, removeFromCart, setCartItems } = useShoppingCart();
  const { user } = useAuth();
  
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  const [deliveryTime, setDeliveryTime] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Generador de horarios con margen de 45 min
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const preparationMargin = addMinutes(now, 45);
    
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute of ['00', '30']) {
        const slotTime = setMinutes(setHours(new Date(deliveryDate), hour), parseInt(minute));
        if (isSameDay(deliveryDate, now)) {
          if (slotTime > preparationMargin) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
          }
        } else {
          slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
        }
      }
    }
    return slots;
  };

  const availableSlots = generateTimeSlots();

  useEffect(() => {
    if (availableSlots.length > 0 && (!deliveryTime || !availableSlots.includes(deliveryTime))) {
      setDeliveryTime(availableSlots[0]);
    }
  }, [deliveryDate, availableSlots]);

  const total = cartTotal + (cartTotal > 0 && cartTotal < 100 ? 30 : 0);

  const handleCheckout = async () => {
    if (!phone || phone.length < 10) return alert('Ingresa un teléfono válido.');
    if (!deliveryTime) return alert('Selecciona una hora válida.');

    setLoading(true);
    try {
      // NOTA: Para no dar error en Supabase si no has creado las columnas, 
      // enviamos la fecha/hora como parte de un objeto de metadatos o texto
      const orderDetails = {
        usuario_email: user?.email || 'Invitado',
        detalle_pedido: cartItems, // Aquí van los productos
        total: total,
        estado: 'Pendiente',
        telefono_cliente: `${phone} (Entrega: ${format(deliveryDate, 'dd/MM')} ${deliveryTime}hs)`
      };

      const { error } = await supabase.from('pedidos').insert([orderDetails]);
      
      if (error) {
        console.error('Error Supabase:', error);
        throw new Error('No se pudo guardar en la base de datos');
      }

      // 2. DISPARAR WHATSAPP (Esto es lo que más le importa a Hugo)
      let message = `*NUEVO PEDIDO - AMOREE*\n`;
      message += `--------------------------\n`;
      message += `📅 FECHA: ${format(deliveryDate, 'dd/MM/yyyy')}\n`;
      message += `⏰ HORA: ${deliveryTime} hrs\n`;
      message += `📞 TEL: ${phone}\n`;
      message += `--------------------------\n`;
      cartItems.forEach(item => {
        message += `• ${item.quantity} ${item.unidad} x ${item.nombre}\n`;
      });
      message += `--------------------------\n`;
      message += `💰 *TOTAL APROX: ${formatCurrency(total)}*\n\n`;
      message += `_Por favor, confirma que recibiste mi pedido._`;
      
      const whatsappUrl = `https://wa.me/522211559132?text=${encodeURIComponent(message)}`;
      
      // Limpiar carrito y redirigir
      setCartItems([]);
      window.open(whatsappUrl, '_blank');

    } catch (error) {
      alert('Hubo un problema al generar el pedido. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) return <div className="p-8 text-center text-gray-400 italic">Canasta vacía</div>;

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-3xl shadow-xl border m-4">
      <h2 className="text-xl font-black text-green-900 mb-4 uppercase italic">Tu Pedido</h2>
      
      {/* Lista de productos reducida para ahorrar espacio */}
      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
        {cartItems.map((item) => (
          <div key={item.sku} className="flex justify-between text-xs bg-gray-50 p-2 rounded-xl">
            <span>{item.nombre} ({item.quantity} {item.unidad})</span>
            <button onClick={() => removeFromCart(item.sku)} className="text-red-400">✕</button>
          </div>
        ))}
      </div>

      <div className="bg-green-50 rounded-2xl p-4 space-y-3 border border-green-100 mb-4">
        <input 
          type="tel" placeholder="Tu Teléfono (10 dígitos)" value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl py-2 px-4 text-sm font-bold outline-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            selected={deliveryDate}
            onChange={(date: Date) => setDeliveryDate(date)}
            minDate={new Date()}
            dateFormat="dd/MM/yyyy"
            locale="es"
            className="w-full rounded-xl py-2 px-3 text-xs font-bold outline-none"
          />
          <select
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            className="w-full rounded-xl py-2 px-3 text-xs font-bold outline-none"
          >
            {availableSlots.length > 0 ? (
              availableSlots.map(slot => <option key={slot} value={slot}>{slot} hrs</option>)
            ) : (
              <option value="">Cerrado</option>
            )}
          </select>
        </div>
      </div>

      <div className="flex justify-between font-black text-lg text-green-800 border-t border-dashed pt-3">
        <span>TOTAL:</span>
        <span>{formatCurrency(total)}</span>
      </div>

      <button 
        onClick={handleCheckout} disabled={loading}
        className="w-full bg-green-600 text-white font-black py-4 rounded-2xl mt-4 shadow-lg active:scale-95 transition-all"
      >
        {loading ? 'PROCESANDO...' : '🚀 ENVIAR PEDIDO'}
      </button>
    </div>
  );
}
