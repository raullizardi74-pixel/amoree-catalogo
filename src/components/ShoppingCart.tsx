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

  // --- LÓGICA DE HORARIOS INTELIGENTES ---
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const preparationMargin = addMinutes(now, 45); // Margen de 45 minutos
    
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute of ['00', '30']) {
        const slotTime = setMinutes(setHours(new Date(deliveryDate), hour), parseInt(minute));
        
        // Si la fecha seleccionada es HOY, filtramos las horas pasadas + margen
        if (isSameDay(deliveryDate, now)) {
          if (slotTime > preparationMargin) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
          }
        } else {
          // Si es otro día, mostramos todas las opciones
          slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
        }
      }
    }
    return slots;
  };

  const availableSlots = generateTimeSlots();

  // Actualizar la hora seleccionada por defecto si la actual queda fuera de rango
  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(deliveryTime)) {
      setDeliveryTime(availableSlots[0]);
    } else if (availableSlots.length === 0) {
      setDeliveryTime('');
    }
  }, [deliveryDate, availableSlots]);

  const shippingCost = cartTotal > 0 && cartTotal < 100 ? 30 : 0;
  const total = cartTotal + shippingCost;

  const handleCheckout = async () => {
    if (!phone || phone.length < 10) {
      alert('Por favor, ingresa un número de teléfono válido.');
      return;
    }

    if (availableSlots.length === 0 && isSameDay(deliveryDate, new Date())) {
      alert('Amoree ya no acepta más pedidos por hoy debido al horario de cierre. Por favor selecciona otra fecha.');
      return;
    }

    if (!deliveryTime) {
      alert('Por favor selecciona una hora de entrega válida.');
      return;
    }

    setLoading(true);
    try {
      const orderDetails = {
        usuario_email: user?.email || 'Invitado',
        detalle_pedido: cartItems,
        total: total,
        estado: 'Pendiente',
        telefono_cliente: phone,
        fecha_entrega: format(deliveryDate, 'yyyy-MM-dd'),
        hora_entrega: deliveryTime
      };

      const { error } = await supabase.from('pedidos').insert([orderDetails]);
      if (error) throw error;

      // Generar mensaje de WhatsApp
      let message = `*NUEVO PEDIDO - AMOREE*\n`;
      message += `--------------------------\n`;
      message += `📅 Fecha: ${format(deliveryDate, 'dd/MM/yyyy')}\n`;
      message += `⏰ Hora: ${deliveryTime} hrs\n`;
      message += `📞 Tel: ${phone}\n`;
      message += `--------------------------\n`;
      cartItems.forEach(item => {
        message += `• ${item.quantity} ${item.unidad} x ${item.nombre}\n`;
      });
      message += `--------------------------\n`;
      message += `💰 *TOTAL: ${formatCurrency(total)}*\n`;
      
      const whatsappUrl = `https://wa.me/522211559132?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      setCartItems([]);
    } catch (error) {
      console.error(error);
      alert('Error al procesar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-gray-100 mx-4 mt-4">
        <p className="text-gray-400 font-bold italic uppercase text-xs tracking-widest">Tu canasta Amoree está vacía</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 m-4">
      <h2 className="text-xl font-black text-green-900 mb-4 uppercase italic tracking-tighter">Tu Pedido</h2>
      
      <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {cartItems.map((item) => (
          <div key={item.sku} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
            <div className="flex-1">
              <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {item.quantity} {item.unidad} x {formatCurrency(item.precio_venta)}
              </p>
            </div>
            <button 
              onClick={() => removeFromCart(item.sku)}
              className="text-red-400 hover:text-red-600 p-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="bg-green-50 rounded-2xl p-4 space-y-4 border border-green-100 mb-6">
        <div>
          <label className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1 block">Teléfono de Contacto</label>
          <input 
            type="tel" 
            placeholder="Ej: 2221234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white border-0 rounded-xl py-2 px-4 text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1 block">Fecha</label>
            <DatePicker
              selected={deliveryDate}
              onChange={(date: Date) => setDeliveryDate(date)}
              minDate={new Date()}
              dateFormat="dd/MM/yyyy"
              locale="es"
              className="w-full bg-white border-0 rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-1 block">Hora Estimada</label>
            <select
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              disabled={availableSlots.length === 0}
              className="w-full bg-white border-0 rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-green-400 outline-none disabled:bg-gray-100 disabled:text-gray-400"
            >
              {availableSlots.length > 0 ? (
                availableSlots.map(slot => (
                  <option key={slot} value={slot}>{slot} hrs</option>
                ))
              ) : (
                <option value="">Cerrado</option>
              )}
            </select>
          </div>
        </div>
        
        {availableSlots.length === 0 && isSameDay(deliveryDate, new Date()) && (
          <p className="text-[9px] text-red-500 font-black uppercase text-center animate-pulse">
            ⚠️ Horario límite alcanzado para hoy
          </p>
        )}
      </div>

      <div className="pt-3 border-t-2 border-dashed border-gray-100 space-y-1">
        <div className="flex justify-between font-black text-lg text-green-800">
          <span>TOTAL APROX.</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <button 
        onClick={handleCheckout} 
        disabled={loading}
        className="w-full bg-green-600 text-white font-extrabold py-3 px-4 rounded-xl mt-4 hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 disabled:bg-gray-300"
      >
        {loading ? 'PROCESANDO...' : 'ENVIAR PEDIDO A AMOREE'}
      </button>
    </div>
  );
}
