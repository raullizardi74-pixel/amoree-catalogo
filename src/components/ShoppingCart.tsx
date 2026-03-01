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

  // Lógica de horarios con margen de 45 min
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

  // CORRECCIÓN PUNTO 2: Lógica de envío transparente
  const shippingCost = (cartTotal > 0 && cartTotal < 100) ? 30 : 0;
  const totalFinal = cartTotal + shippingCost;

  const handleCheckout = async () => {
    if (!phone || phone.length < 10) return alert('Por favor ingresa tu celular a 10 dígitos.');
    if (!deliveryTime) return alert('Selecciona una hora de entrega.');

    setLoading(true);

    const messageDate = format(deliveryDate, 'dd/MM/yyyy');
    
    // MENSAJE DE WHATSAPP DESGLOSADO
    let message = `*NUEVO PEDIDO - AMOREE*\n`;
    message += `--------------------------\n`;
    message += `📅 FECHA: ${messageDate}\n`;
    message += `⏰ HORA: ${deliveryTime} hrs\n`;
    message += `📞 TEL: ${phone}\n`;
    message += `--------------------------\n`;
    cartItems.forEach(item => {
      const sub = item.precio_venta * item.quantity;
      message += `• ${item.quantity} ${item.unidad} x ${item.nombre} = ${formatCurrency(sub)}\n`;
    });
    message += `--------------------------\n`;
    if (shippingCost > 0) message += `🚚 Envío: ${formatCurrency(shippingCost)}\n`;
    message += `💰 *TOTAL: ${formatCurrency(totalFinal)}*\n\n`;
    message += `_Favor de confirmar el pedido._`;

    // CORRECCIÓN PUNTO 1: Número de prueba socio
    const whatsappUrl = `https://wa.me/522215306435?text=${encodeURIComponent(message)}`;

    try {
      // Guardar en Supabase para que Hugo lo vea en su panel
      const { error } = await supabase.from('pedidos').insert([{
        usuario_email: user?.email || `Invitado_${phone}`,
        detalle_pedido: cartItems,
        total: totalFinal,
        estado: 'Pendiente',
        telefono_cliente: `${phone} (Entrega: ${messageDate} ${deliveryTime})`
      }]);

      if (error) console.warn("Error DB (RLS), pero procedemos a WhatsApp");

      setCartItems([]);
      window.open(whatsappUrl, '_blank');
    } catch (e) {
      window.open(whatsappUrl, '_blank');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="p-10 text-center bg-white rounded-3xl m-4 shadow-sm border border-gray-100">
        <p className="text-gray-400 font-bold italic text-sm uppercase">Tu canasta está vacía</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 m-2">
      <h2 className="text-2xl font-black text-green-900 mb-6 uppercase italic tracking-tighter">Mi Pedido</h2>
      
      {/* CORRECCIÓN PUNTO 3: Lista detallada con contraste */}
      <div className="space-y-3 mb-6 max-h-72 overflow-y-auto pr-2">
        {cartItems.map((item) => (
          <div key={item.sku} className="bg-gray-50 p-3 rounded-2xl border border-gray-200 relative">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-black text-gray-800 text-sm leading-tight mb-1">{item.nombre}</p>
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
                  {item.quantity} {item.unidad} x {formatCurrency(item.precio_venta)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900 text-sm">
                  {formatCurrency(item.precio_venta * item.quantity)}
                </p>
                <button 
                  onClick={() => removeFromCart(item.sku)}
                  className="text-red-400 text-[10px] font-bold mt-1 underline"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FORMULARIO CON CONTRASTE ALTO */}
      <div className="bg-green-50 rounded-3xl p-5 border-2 border-green-100 mb-6 space-y-4 shadow-inner">
        <div>
          <label className="text-[10px] font-black text-green-800 uppercase tracking-widest mb-1.5 block ml-1">Número de Celular</label>
          <input 
            type="tel" 
            placeholder="10 dígitos para contactarte"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black text-green-900 placeholder-green-200 focus:ring-4 focus:ring-green-100 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-green-800 uppercase tracking-widest mb-1.5 block ml-1">Fecha</label>
            <DatePicker
              selected={deliveryDate}
              onChange={(date: Date) => setDeliveryDate(date)}
              minDate={new Date()}
              dateFormat="dd/MM/yyyy"
              locale="es"
              className="w-full bg-white border-2 border-green-200 rounded-2xl py-2 px-3 text-xs font-bold text-gray-700 outline-none shadow-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-green-800 uppercase tracking-widest mb-1.5 block ml-1">Hora</label>
            <select
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="w-full bg-white border-2 border-green-200 rounded-2xl py-2 px-3 text-xs font-bold text-gray-700 outline-none shadow-sm"
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

      {/* DESGLOSE DE TOTALES */}
      <div className="px-2 space-y-2 mb-4">
        <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
          <span>Subtotal:</span>
          <span>{formatCurrency(cartTotal)}</span>
        </div>
        <div className="flex justify-between text-xs font-bold text-red-500 uppercase tracking-widest">
          <span>Envío:</span>
          <span>{shippingCost === 0 ? '¡GRATIS!' : formatCurrency(shippingCost)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-gray-200">
          <span className="text-xl font-black text-green-900">TOTAL</span>
          <span className="text-2xl font-black text-green-900 tracking-tighter">{formatCurrency(totalFinal)}</span>
        </div>
      </div>

      <button 
        onClick={handleCheckout} 
        disabled={loading}
        className="w-full bg-green-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-green-100 active:scale-95 transition-all text-sm uppercase tracking-[0.2em]"
      >
        {loading ? 'GENERANDO...' : '🚀 Enviar Pedido'}
      </button>
    </div>
  );
}
