import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function ClientsModule() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
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

  if (loading) return <div className="p-10 text-center font-black animate-pulse">CARGANDO CARTERA...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Cartera de <span className="text-blue-600">Clientes</span></h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cuentas por cobrar y fidelización</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
        >
          + Nuevo Cliente
        </button>
      </div>

      {/* LISTADO DE CLIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientes.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-2 h-full ${c.saldo_deudor > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Cliente Frecuente</p>
            <h3 className="text-xl font-black text-gray-800 uppercase leading-none mb-4">{c.nombre}</h3>
            
            <div className="space-y-2 mb-6">
              <p className="text-[11px] font-bold text-gray-500">📞 {c.telefono}</p>
              <p className="text-[11px] font-bold text-gray-500">📧 {c.email || 'Sin correo'}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-end">
               <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase">Deuda Acumulada</p>
                  <p className={`text-2xl font-black tracking-tighter ${c.saldo_deudor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(c.saldo_deudor)}
                  </p>
               </div>
               <button className="text-[9px] font-black text-blue-600 uppercase underline decoration-2 underline-offset-4">Ver Estado</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL AGREGAR CLIENTE */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic mb-8">Alta de Cliente</h3>
            <div className="space-y-4">
              <input 
                placeholder="Nombre Completo (Ej. Julieta Adame)" 
                className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0 outline-none focus:ring-2 focus:ring-blue-400"
                onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
              />
              <input 
                placeholder="Teléfono (WhatsApp)" 
                className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0 outline-none focus:ring-2 focus:ring-blue-400"
                onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
              />
              <input 
                placeholder="Email (Opcional)" 
                className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0 outline-none focus:ring-2 focus:ring-blue-400"
                onChange={e => setNuevoCliente({...nuevoCliente, email: e.target.value})}
              />
            </div>
            <div className="flex gap-4 mt-8">
               <button onClick={() => setShowAdd(false)} className="flex-1 font-black text-[10px] uppercase text-gray-400">Cancelar</button>
               <button onClick={handleAddCliente} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100">Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
