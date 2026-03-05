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
  const [guestName, setGuestName] = useState(''); // Para usuarios no logueados
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

  const totalFinal = cartTotal + (cartTotal > 0 && cartTotal < 100 ? 30 : 0);

  const handleCheckout = async () => {
    const finalName = user?.user_metadata?.full_name || guestName;
    if (!finalName) return alert('Por favor dinos tu nombre para el pedido.');
    if (!phone || phone.length < 10) return alert('Ingresa tu celular a 10 dígitos.');
    
    setLoading(true);
    try {
      const { error } = await supabase.from('pedidos').insert([{
        usuario_email: user?.email || 'pedido_invitado',
        nombre_cliente: finalName,
        detalle_pedido: cartItems,
        total: totalFinal,
        estado: 'Pendiente',
        origen: 'App',
        telefono_cliente: `${phone} (Entrega: ${format(deliveryDate, 'dd/MM/yyyy')} ${deliveryTime})`
      }]);

      if (error) throw error;

      let message = `*NUEVO PEDIDO - AMOREE*\n`;
      message += `--------------------------\n`;
      message += `👤 CLIENTE: ${finalName}\n`;
      message += `📅 FECHA: ${format(deliveryDate, 'dd/MM/yyyy')}\n`;
      message += `⏰ HORA: ${deliveryTime} hrs\n`;
      message += `📞 TEL: ${phone}\n`;
      message += `--------------------------\n`;
      cartItems.forEach(item => {
        message += `• ${item.quantity} ${item.unidad || 'Kg'} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
      });
      message += `--------------------------\n`;
      message += `💰 *TOTAL APROX: ${formatCurrency(totalFinal)}*\n\n`;
      message += `_Favor de confirmar el pedido._`;

      setCartItems([]);
      window.open(`https://wa.me/522215306435?text=${encodeURIComponent(message)}`, '_blank');
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) return <div className="p-10 text-center text-gray-400 font-black uppercase">Canasta vacía</div>;

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-[2.5rem] shadow-2xl border border-gray-100">
      <h2 className="text-2xl font-black text-gray-900 uppercase italic mb-6">Mi Pedido</h2>
      
      <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
        {cartItems.map((item) => (
          <div key={item.sku} className="bg-gray-50 p-4 rounded-3xl flex justify-between items-center">
            <div>
              <p className="font-black text-gray-800 text-xs uppercase">{item.nombre}</p>
              <p className="text-[9px] font-bold text-green-600 uppercase mt-1">{item.quantity} {item.unidad || 'Kg'}</p>
            </div>
            <p className="font-black text-gray-900 text-sm">{formatCurrency(item.precio_venta * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="bg-green-50 rounded-[2rem] p-6 space-y-4 mb-6">
        {/* Captura de Nombre si no hay Login */}
        {!user && (
          <div>
            <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1 block">Tu Nombre y Apellido</label>
            <input 
              type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)}
              className="w-full bg-white border border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none"
            />
          </div>
        )}
        
        <div>
          <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1 block">Tu Celular</label>
          <input 
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-white border border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <DatePicker selected={deliveryDate} onChange={(date: Date) => setDeliveryDate(date)} minDate={new Date()} dateFormat="dd/MM/yyyy" locale="es" className="w-full bg-white border border-green-200 rounded-2xl py-3 px-4 text-xs font-bold outline-none" />
          <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full bg-white border border-green-200 rounded-2xl py-3 px-4 text-xs font-bold outline-none">
            {availableSlots.map(slot => <option key={slot} value={slot}>{slot} hrs</option>)}
          </select>
        </div>
      </div>

      <div className="pt-4 border-t-2 border-dashed border-gray-100 mb-6 flex justify-between items-center">
        <span className="text-xl font-black text-gray-900 uppercase">Total</span>
        <span className="text-3xl font-black text-green-600 tracking-tighter">{formatCurrency(totalFinal)}</span>
      </div>

      <button onClick={handleCheckout} disabled={loading} className="w-full bg-gray-900 text-white font-black py-6 rounded-[2rem] shadow-2xl uppercase tracking-[0.2em] text-xs">
        {loading ? 'PROCESANDO...' : '🚀 Enviar Pedido'}
      </button>
    </div>
  );
}
