import { useState, useEffect } from 'react';
import { useShoppingCart } from '../context/ShoppingCartContext';
import { formatCurrency } from '../lib/utils';
import DatePicker, { registerLocale } from 'react-datepicker';
import { format, addMinutes, isSameDay, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  ShoppingBasket, X, ChevronDown, ChevronUp, Phone, 
  User, Calendar, Clock, Send, Plus, Minus, Trash2, ArrowLeft 
} from 'lucide-react';

registerLocale('es', es);

export default function ShoppingCart() {
  const { cartItems, cartTotal, setCartItems, addToCart, decrementCartItem } = useShoppingCart();
  const { user } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-500 ease-in-out ${isOpen ? 'h-[100vh]' : 'h-20'}`}>
      
      {isOpen && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={() => setIsOpen(false)} />}

      <div className={`h-full bg-white transition-all overflow-hidden ${isOpen ? 'rounded-t-none' : 'rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.2)] border-t border-gray-100'}`}>
        
        {/* BARRA SUPERIOR (HEADER) */}
        <div 
          onClick={() => cartItems.length > 0 && setIsOpen(!isOpen)}
          className={`h-20 shrink-0 px-6 flex justify-between items-center cursor-pointer transition-colors ${isOpen ? 'bg-gray-50 border-b border-gray-200' : ''}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${cartItems.length > 0 ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
              <ShoppingBasket size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Mi Canasta</p>
              <p className="text-xl font-black text-gray-900 tracking-tighter uppercase italic">
                {cartItems.length === 0 ? 'Vacía' : formatCurrency(totalFinal)}
              </p>
            </div>
          </div>
          
          {cartItems.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 font-black text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest">
                {cartItems.length} Artículos
              </span>
              {isOpen ? <ChevronDown className="text-gray-400" /> : <ChevronUp className="text-gray-400" />}
            </div>
          )}
        </div>

        {/* CONTENIDO EXPANDIDO */}
        {isOpen && (
          <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
            
            {/* BOTÓN VOLVER (Seguir comprando) */}
            <div className="px-6 py-4">
              <button 
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-widest hover:translate-x-1 transition-transform"
              >
                <ArrowLeft size={14} strokeWidth={3}/> Seguir Comprando
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
              <h2 className="text-2xl font-black text-gray-900 mb-6 uppercase italic tracking-tighter">Resumen del Pedido</h2>
              
              {/* LISTA CON CONTROLES DE EDICIÓN */}
              <div className="space-y-3 mb-8">
                {cartItems.map((item) => {
                   const step = (item.unidad || 'kg').toLowerCase() === 'kg' ? 0.25 : 1;
                   return (
                    <div key={item.sku} className="bg-gray-50 p-4 rounded-3xl flex justify-between items-center border border-gray-100">
                      <div className="flex-1 pr-4">
                        <p className="font-black text-gray-800 text-[11px] uppercase truncate">{item.nombre}</p>
                        <p className="text-[10px] font-bold text-gray-400">{formatCurrency(item.precio_venta)} x {item.unidad || 'kg'}</p>
                      </div>

                      {/* ✅ CONTROLES DE CANTIDAD EN TIEMPO REAL */}
                      <div className="flex items-center bg-white border border-gray-200 rounded-2xl p-1 gap-3">
                        <button 
                          onClick={() => decrementCartItem(item.sku, step)}
                          className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors rounded-xl"
                        >
                          {item.quantity <= step ? <Trash2 size={16}/> : <Minus size={16} strokeWidth={3}/>}
                        </button>
                        <span className="font-black text-gray-900 text-xs min-w-[20px] text-center">{Number(item.quantity.toFixed(2))}</span>
                        <button 
                          onClick={() => addToCart(item, step)}
                          className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-green-50 transition-colors rounded-xl"
                        >
                          <Plus size={16} strokeWidth={3}/>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DATOS DE ENTREGA */}
              <div className="bg-green-50 rounded-[2.5rem] p-6 border-2 border-green-100 mb-8 space-y-5">
                {!user && (
                  <div>
                    <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><User size={12}/> Tu Nombre</label>
                    <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none focus:border-green-600" />
                  </div>
                )}
                <div>
                  <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Phone size={12}/> WhatsApp</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-4 text-sm font-black outline-none focus:border-green-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Calendar size={12}/> Día</label>
                    <DatePicker selected={deliveryDate} onChange={(date: Date) => setDeliveryDate(date)} minDate={new Date()} dateFormat="dd/MM/yyyy" locale="es" className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-3 text-[10px] font-black outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-green-800 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Clock size={12}/> Hora</label>
                    <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full bg-white border-2 border-green-200 rounded-2xl py-3 px-3 text-[10px] font-black outline-none">
                      {availableSlots.map(slot => <option key={slot} value={slot}>{slot} hrs</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* PIE DE PAGO */}
              <div className="px-2 space-y-3 pb-10">
                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest"><span>Subtotal</span><span>{formatCurrency(cartTotal)}</span></div>
                <div className="flex justify-between text-[10px] font-black text-red-500 uppercase tracking-widest"><span>Envío</span><span>{shippingCost === 0 ? '¡GRATIS!' : formatCurrency(shippingCost)}</span></div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-dashed border-gray-200">
                  <span className="text-2xl font-black text-green-900 italic tracking-tighter uppercase">Total</span>
                  <span className="text-3xl font-black text-green-900 tracking-tighter">{formatCurrency(totalFinal)}</span>
                </div>
                <button onClick={handleCheckout} disabled={loading || availableSlots.length === 0} className="w-full bg-gray-900 text-white font-black py-6 rounded-3xl shadow-2xl active:scale-95 transition-all text-xs uppercase tracking-[0.2em] mt-8 flex items-center justify-center gap-3">
                  {loading ? 'PROCESANDO...' : <><Send size={18}/> Enviar a Amoree</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
