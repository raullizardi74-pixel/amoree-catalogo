import { useState, useEffect } from 'react';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import DatePicker, { registerLocale } from 'react-datepicker';
import { format, addMinutes, isSameDay, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ShoppingBasket, X, ChevronUp, ChevronDown, Phone, User, Calendar, Clock, Send } from 'lucide-react';

registerLocale('es', es);

export default function ShoppingCart() {
  const { cartItems, cartTotal, setCartItems } = useShoppingCart();
  const { user } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false); // ✅ Controla si el carrito está expandido
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

  const shippingCost = (cartTotal > 0 && cartTotal < 100) ? 30 : 0;
  const totalFinal = cartTotal + shippingCost;

  const handleCheckout = async () => {
    const finalName = user?.user_metadata?.full_name || guestName;
    if (!finalName) return alert('Por favor dinos tu nombre.');
    if (!phone || phone.length < 10) return alert('Celular a 10 dígitos requerido.');
    
    setLoading(true);
    const messageDate = format(deliveryDate, 'dd/MM/yyyy');
    
    try {
      await supabase.from('pedidos').insert([{
        usuario_email: user?.email || `Invitado_${phone}`,
        nombre_cliente: finalName,
        detalle_pedido: cartItems,
        total: totalFinal,
        estado: 'Pendiente',
        telefono_cliente: `${phone} (E: ${messageDate} ${deliveryTime})`
      }]);

      let message = `*NUEVO PEDIDO - AMOREE*\n--------------------------\n👤 CLIENTE: ${finalName}\n📅 FECHA: ${messageDate}\n⏰ HORA: ${deliveryTime} hrs\n📞 TEL: ${phone}\n--------------------------\n`;
      cartItems.forEach(item => {
        message += `• ${item.quantity}${item.unidad || 'kg'} x ${item.nombre} = ${formatCurrency(item.precio_venta * item.quantity)}\n`;
      });
      message += `--------------------------\n`;
      message += `🚚 Envío: ${shippingCost === 0 ? '¡GRATIS!' : formatCurrency(shippingCost)}\n`;
      message += `💰 *TOTAL APROX: ${formatCurrency(totalFinal)}*\n\n`;
      message += `⚠️ *NOTA:* Amoree confirmará el total final en base al peso real al surtir.\n\n_Favor de confirmar._`;

      window.open(`https://wa.me/522215306435?text=${encodeURIComponent(message)}`, '_blank');
      setCartItems([]);
      setIsOpen(false);
    } catch (e) { alert("Error al guardar."); }
    finally { setLoading(false); }
  };

  // ✅ BARRA FLOTANTE CUANDO ESTÁ CERRADO O VACÍO
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-500 ease-in-out ${isOpen ? 'h-[90vh]' : 'h-20'}`}>
      
      {/* Fondo oscuro cuando está abierto */}
      {isOpen && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={() => setIsOpen(false)} />}

      <div className={`h-full bg-white rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.2)] border-t border-gray-100 flex flex-col transition-all overflow-hidden ${!isOpen && cartItems.length === 0 ? 'opacity-50' : 'opacity-100'}`}>
        
        {/* HEADER DE LA CANASTA (Siempre visible) */}
        <div 
          onClick={() => cartItems.length > 0 && setIsOpen(!isOpen)}
          className="h-20 shrink-0 px-6 flex justify-between items-center cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${cartItems.length > 0 ? 'bg-green-600 text-white animate-bounce-slow' : 'bg-gray-100 text-gray-400'}`}>
              <ShoppingBasket size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tu Canasta</p>
              <p className="text-xl font-black text-gray-900 tracking-tighter uppercase italic">
                {cartItems.length === 0 ? 'Vacía' : formatCurrency(totalFinal)}
              </p>
            </div>
          </div>
          
          {cartItems.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 font-black text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest">
                {cartItems.length} Items
              </span>
              {isOpen ? <ChevronDown className="text-gray-400" /> : <ChevronUp className="text-gray-400" />}
            </div>
          )}
        </div>

        {/* CUERPO DEL PEDIDO (Solo visible cuando isOpen es true) */}
        {isOpen && (
          <div className="flex-1 overflow-y-auto px-6 pb-20 no-scrollbar">
            <div className="space-y-3 mb-8">
              {cartItems.map((item) => (
                <div key={item.sku} className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100">
                  <div className="flex-1">
                    <p className="font-black text-gray-800 text-[11px] uppercase truncate pr-4">{item.nombre}</p>
                    <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">{item.quantity} {item.unidad || 'kg'}</p>
                  </div>
                  <p className="font-black text-gray-900 text-xs shrink-0">{formatCurrency(item.precio_venta * item.quantity)}</p>
                </div>
              ))}
            </div>

            {/* FORMULARIO TITANIUM */}
            <div className="bg-green-50 rounded-[2rem] p-6 border-2 border-green-100 mb-8 space-y-5 shadow-inner">
              {!user && (
                <div>
                  <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><User size={12}/> Nombre Completo</label>
                  <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none focus:border-green-600 transition-all" />
                </div>
              )}
              <div>
                <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Phone size={12}/> WhatsApp (10 dígitos)</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none focus:border-green-600 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Calendar size={12}/> Fecha</label>
                  <DatePicker selected={deliveryDate} onChange={(date: Date) => setDeliveryDate(date)} minDate={new Date()} dateFormat="dd/MM/yyyy" locale="es" className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-3 text-[10px] font-black outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Clock size={12}/> Horario</label>
                  <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-3 text-[10px] font-black outline-none">
                    {availableSlots.map(slot => <option key={slot} value={slot}>{slot} hrs</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* RESUMEN FINAL */}
            <div className="px-2 space-y-2 mb-10">
              <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>Subtotal:</span><span>{formatCurrency(cartTotal)}</span></div>
              <div className="flex justify-between text-[10px] font-black text-red-500 uppercase"><span>Envío:</span><span>{shippingCost === 0 ? '¡GRATIS!' : formatCurrency(shippingCost)}</span></div>
              <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-gray-200">
                <span className="text-2xl font-black text-green-900 tracking-tighter">TOTAL</span>
                <span className="text-3xl font-black text-green-900 tracking-tighter">{formatCurrency(totalFinal)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6">
                <p className="text-[9px] text-amber-700 font-bold leading-tight text-center italic">
                  ⚠️ Amoree confirmará el total final según el peso real de la báscula al surtir.
                </p>
              </div>
              <button onClick={handleCheckout} disabled={loading || availableSlots.length === 0} className="w-full bg-green-600 text-white font-black py-6 rounded-3xl shadow-2xl active:scale-95 transition-all text-xs uppercase tracking-[0.2em] mt-6 flex items-center justify-center gap-3">
                {loading ? 'GENERANDO...' : <><Send size={18}/> Enviar Pedido por WA</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
