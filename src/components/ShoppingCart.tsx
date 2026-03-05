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
  const { cartItems, cartTotal, setCartItems } = useShoppingCart();
  const { user } = useAuth();
  
  const [deliveryDate, setDeliveryDate] = useState(new Date());
  const [deliveryTime, setDeliveryTime] = useState('');
  const [phone, setPhone] = useState('');
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);

  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const preparationMargin = addMinutes(now, 45);
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute of ['00', '30']) {
        const slotTime = setMinutes(setHours(new Date(deliveryDate), hour), parseInt(minute));
        if (isSameDay(deliveryDate, now)) {
          if (slotTime > preparationMargin) slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
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

  // LÓGICA DE ENVÍO RESTAURADA
  const shippingCost = (cartTotal > 0 && cartTotal < 100) ? 30 : 0;
  const totalFinal = cartTotal + shippingCost;

  const handleCheckout = async () => {
    const finalName = user?.user_metadata?.full_name || guestName;
    if (!finalName) return alert('Por favor dinos tu nombre para el pedido.');
    if (!phone || phone.length < 10) return alert('Ingresa tu celular a 10 dígitos.');
    if (!deliveryTime) return alert('No hay horarios disponibles para hoy.');

    setLoading(true);
    const messageDate = format(deliveryDate, 'dd/MM/yyyy');
    
    try {
      await supabase.from('pedidos').insert([{
        usuario_email: user?.email || `Invitado_${phone}`,
        nombre_cliente: finalName,
        detalle_pedido: cartItems,
        total: totalFinal,
        estado: 'Pendiente',
        telefono_cliente: `${phone} (Entrega: ${messageDate} ${deliveryTime})`
      }]);

      let message = `*NUEVO PEDIDO - AMOREE*\n`;
      message += `--------------------------\n`;
      message += `👤 CLIENTE: ${finalName}\n`;
      message += `📅 FECHA: ${messageDate}\n`;
      message += `⏰ HORA: ${deliveryTime} hrs\n`;
      message += `📞 TEL: ${phone}\n`;
      message += `--------------------------\n`;
      cartItems.forEach(item => {
        message += `• ${item.quantity} ${item.unidad || 'kg'} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
      });
      message += `--------------------------\n`;
      if (shippingCost > 0) message += `🚚 Envío: ${formatCurrency(shippingCost)}\n`;
      else message += `🚚 Envío: ¡GRATIS!\n`;
      message += `💰 *TOTAL APROX: ${formatCurrency(totalFinal)}*\n\n`;
      message += `⚠️ *NOTA:* Amoree preparará tu pedido y confirmará el total final en base al peso real de la báscula al momento de surtir.\n\n`;
      message += `_Favor de confirmar el pedido._`;

      window.open(`https://wa.me/522215306435?text=${encodeURIComponent(message)}`, '_blank');
      setCartItems([]);
    } catch (e) { alert("Error al guardar pedido."); }
    finally { setLoading(false); }
  };

  if (cartItems.length === 0) return <div className="p-10 text-center text-gray-400 font-black uppercase">Canasta vacía</div>;

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 m-2">
      <h2 className="text-2xl font-black text-green-900 mb-6 uppercase italic tracking-tighter leading-none">Mi Pedido</h2>
      
      {/* LISTA DE ITEMS */}
      <div className="space-y-2 mb-6 max-h-52 overflow-y-auto pr-1">
        {cartItems.map((item) => (
          <div key={item.sku} className="bg-gray-50 p-3 rounded-2xl flex justify-between items-center border border-gray-100">
            <div>
              <p className="font-black text-gray-800 text-[11px] uppercase">{item.nombre}</p>
              <p className="text-[9px] font-bold text-green-600 uppercase">{item.quantity} {item.unidad || 'kg'}</p>
            </div>
            <p className="font-black text-gray-900 text-xs">{formatCurrency(item.precio_venta * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="bg-green-50 rounded-[2rem] p-5 border-2 border-green-100 mb-6 space-y-4">
        {/* IDENTIDAD FLEXIBLE */}
        {!user && (
          <div>
            <label className="text-[10px] font-black text-green-800 uppercase tracking-widest mb-1 block">Tu Nombre y Apellido</label>
            <input 
              type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none"
            />
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-green-800 uppercase tracking-widest mb-1 block">Tu Celular</label>
          <input 
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DatePicker selected={deliveryDate} onChange={(date: Date) => setDeliveryDate(date)} minDate={new Date()} dateFormat="dd/MM/yyyy" locale="es" className="w-full bg-white border-2 border-green-200 rounded-2xl py-2 px-3 text-xs font-bold outline-none" />
          <div className="relative">
            {availableSlots.length === 0 ? (
              <div className="bg-red-100 text-red-600 rounded-2xl py-2 px-3 text-[10px] font-black text-center border-2 border-red-200">CERRADO</div>
            ) : (
              <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-2 px-3 text-xs font-bold outline-none">
                {availableSlots.map(slot => <option key={slot} value={slot}>{slot} hrs</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="px-2 space-y-2 mb-6">
        <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase">
          <span>Subtotal:</span>
          <span>{formatCurrency(cartTotal)}</span>
        </div>
        <div className="flex justify-between text-[10px] font-black text-red-500 uppercase">
          <span>Envío:</span>
          <span>{shippingCost === 0 ? '¡GRATIS!' : formatCurrency(shippingCost)}</span>
        </div>
        
        {/* LEYENDA DE ENVÍO GRATIS */}
        <p className="text-[8px] font-black text-center text-green-600 uppercase tracking-tighter">
          🚀 Pedidos mayores a $100 el envío es ¡GRATIS!
        </p>

        <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-gray-200">
          <span className="text-xl font-black text-green-900">TOTAL</span>
          <span className="text-2xl font-black text-green-900">{formatCurrency(totalFinal)}</span>
        </div>
        
        {/* NOTA DE BÁSCULA RESTAURADA */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
          <p className="text-[9px] text-amber-700 font-bold leading-tight text-center">
             ⚠️ Amoree preparará tu pedido y confirmará el total final en base al peso real de la báscula al momento de surtir.
          </p>
        </div>
      </div>

      <button onClick={handleCheckout} disabled={loading || availableSlots.length === 0} className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-[0.2em] disabled:bg-gray-400">
        {loading ? 'GENERANDO...' : availableSlots.length === 0 ? 'HORARIO CERRADO' : 'Enviar Pedido'}
      </button>
    </div>
  );
}
