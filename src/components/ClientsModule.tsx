import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function ClientsModule() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAbono, setShowAbono] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '', email: '' });

  useEffect(() => { fetchClientes(); }, []);

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('saldo_deudor', { ascending: false });
    if (data) setClientes(data);
    setLoading(false);
  };

  const handleAddCliente = async () => {
    const { error } = await supabase.from('clientes').insert([nuevoCliente]);
    if (!error) {
      setShowAdd(false);
      setNuevoCliente({ nombre: '', telefono: '', email: '' });
      fetchClientes();
    }
  };

  const handleRegistrarAbono = async () => {
    const monto = parseFloat(montoAbono);
    if (isNaN(monto) || !clienteSeleccionado) return;

    const { error } = await supabase.rpc('registrar_abono', { 
      client_id: clienteSeleccionado.id, 
      monto: monto 
    });

    if (!error) {
      // También registramos el abono como un "pedido" de tipo Abono para que aparezca en el Dashboard
      await supabase.from('pedidos').insert([{
        telefono_cliente: `ABONO: ${clienteSeleccionado.nombre}`,
        total: monto,
        estado: 'Pagado',
        origen: 'Mostrador',
        metodo_pago: 'Efectivo',
        cliente_id: clienteSeleccionado.id
      }]);

      setShowAbono(false);
      setMontoAbono('');
      fetchClientes();
      alert('✅ Abono registrado y saldo actualizado');
    }
  };

  if (loading) return <div className="p-10 text-center font-black animate-pulse">CARGANDO CARTERA...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Cartera de <span className="text-blue-600">Clientes</span></h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestión de Cobranza Amoree</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          + Nuevo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientes.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-xl transition-all">
            <div className={`absolute top-0 right-0 w-2 h-full ${c.saldo_deudor > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Status Cuenta</p>
            <h3 className="text-xl font-black text-gray-800 uppercase leading-none mb-4">{c.nombre}</h3>
            
            <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 mb-6">
               <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Deuda Pendiente</p>
               <p className={`text-3xl font-black tracking-tighter ${c.saldo_deudor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                 {formatCurrency(c.saldo_deudor)}
               </p>
            </div>

            <div className="flex gap-2">
               <button 
                 onClick={() => { setClienteSeleccionado(c); setShowAbono(true); }}
                 className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md active:scale-95 transition-all"
               >
                 💸 Abonar
               </button>
               <button className="flex-1 bg-gray-100 text-gray-400 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">
                 📄 Historial
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PARA ABONAR */}
      {showAbono && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
            <div className="text-center mb-8">
              <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Registrar Pago</p>
              <h3 className="text-2xl font-black uppercase italic leading-tight">{clienteSeleccionado?.nombre}</h3>
            </div>
            
            <div className="bg-gray-50 p-6 rounded-3xl mb-8 text-center border border-gray-100">
               <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Saldo Actual</p>
               <p className="text-2xl font-black text-red-600">{formatCurrency(clienteSeleccionado?.saldo_deudor)}</p>
            </div>

            <input 
              type="number"
              placeholder="¿CUÁNTO VA A PAGAR?"
              className="w-full p-5 rounded-2xl bg-gray-100 font-black text-center text-xl border-0 outline-none focus:ring-4 focus:ring-green-100 mb-8"
              value={montoAbono}
              onChange={e => setMontoAbono(e.target.value)}
            />

            <div className="flex flex-col gap-3">
               <button onClick={handleRegistrarAbono} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-green-100 active:scale-95 transition-all">Confirmar Abono</button>
               <button onClick={() => setShowAbono(false)} className="w-full py-2 font-black uppercase text-[9px] text-gray-400">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALTA CLIENTE (Se mantiene igual) */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic mb-8">Nuevo Cliente Amoree</h3>
            <div className="space-y-4">
              <input placeholder="Nombre Completo" className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0" onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} />
              <input placeholder="Teléfono" className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0" onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-8">
               <button onClick={() => setShowAdd(false)} className="flex-1 font-black text-[10px] uppercase text-gray-400">Cancelar</button>
               <button onClick={handleAddCliente} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-100">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
