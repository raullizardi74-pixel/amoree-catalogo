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
    if (!phone || phone.length < 10) return alert('Ingresa un teléfono de 10 dígitos.');
    if (!deliveryTime) return alert('Selecciona una hora válida.');

    setLoading(true);

    // 1. PREPARAR EL MENSAJE (Lo hacemos primero para asegurar la venta)
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
    message += `_Por favor, confirma mi pedido._`;

    // NÚMERO DE HUGO CORREGIDO SEGÚN TUS CAPTURAS
    const whatsappUrl = `https://wa.me/522211559132?text=${encodeURIComponent(message)}`;

    try {
      // 2. INTENTAR GUARDAR EN SUPABASE
      const { error } = await supabase.from('pedidos').insert([{
        usuario_email: user?.email || `Invitado_${phone}`,
        detalle_pedido: cartItems,
        total: total,
        estado: 'Pendiente',
        telefono_cliente: `${phone} (Entregar: ${format(deliveryDate, 'dd/MM')} ${deliveryTime})`
      }]);

      if (error) {
        console.warn('Nota: Guardado en DB falló (posible RLS), procediendo a WhatsApp...');
      }
      
      // 3. SIEMPRE DISPARAR WHATSAPP (Aunque falle la DB)
      setCartItems([]);
      window.open(whatsappUrl, '_blank');

    } catch (e) {
      // Si todo falla, al menos el WhatsApp sale
      setCartItems([]);
      window.open(whatsappUrl, '_blank');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) return <div className="p-10 text-center text-gray-400 font-bold italic">Cesta vacía</div>;

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-3xl shadow-xl border m-2">
      <h2 className="text-xl font-black text-green-900 mb-4 uppercase italic">Finalizar Compra</h2>
      
      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-1">
        {cartItems.map((item) => (
          <div key={item.sku} className="flex justify-between text-[11px] bg-gray-50 p-2 rounded-xl border border-gray-100">
            <span className="font-bold text-gray-700">{item.nombre}</span>
            <span className="text-green-700 font-black">{item.quantity} {item.unidad}</span>
          </div>
        ))}
      </div>

      <div className="bg-green-50 rounded-2xl p-4 space-y-4 border border-green-100 mb-4">
        <div>
          <label className="text-[10px] font-black text-green-700 uppercase mb-1 block tracking-widest">Tu Celular</label>
          <input 
            type="tel" placeholder="10 dígitos" value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl py-2 px-4 text-sm font-bold border-0 focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-black text-green-700 uppercase mb-1 block tracking-widest">¿Qué día?</label>
            <DatePicker
              selected={deliveryDate}
              onChange={(date: Date) => setDeliveryDate(date)}
              minDate={new Date()}
              dateFormat="dd/MM/yyyy"
              locale="es"
              className="w-full rounded-xl py-2 px-3 text-xs font-bold border-0 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-green-700 uppercase mb-1 block tracking-widest">¿A qué hora?</label>
            <select
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full rounded-xl py-2 px-3 text-xs font-bold border-0 outline-none"
            >
              {availableSlots.length > 0 ? (
                availableSlots.map(slot => <option key={slot} value={slot}>{slot} hrs</option>)
              ) : (
                <option value="">Cerrado</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-between font-black text-lg text-green-800 border-t-2 border-dashed pt-3">
        <span>TOTAL:</span>
        <span>{formatCurrency(total)}</span>
      </div>

      <button 
        onClick={handleCheckout} disabled={loading}
        className="w-full bg-green-600 text-white font-black py-4 rounded-2xl mt-4 shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest"
      >
        {loading ? 'CARGANDO...' : '✅ ENVIAR PEDIDO'}
      </button>
    </div>
  );
}
