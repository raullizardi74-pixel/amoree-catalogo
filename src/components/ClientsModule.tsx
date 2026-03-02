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

  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('saldo_deudor', { ascending: false });
    if (data) setClientes(data);
    setLoading(false);
  };

  useEffect(() => { fetchClientes(); }, []);

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
      await supabase.from('pedidos').insert([{
        telefono_cliente: `ABONO: ${clienteSeleccionado.nombre}`,
        total: monto,
        estado: 'Pagado',
        origen: 'Mostrador',
        metodo_pago: 'Efectivo',
        cliente_id: clienteSeleccionado.id,
        detalle_pedido: [] 
      }]);

      setShowAbono(false);
      setMontoAbono('');
      fetchClientes();
    }
  };

  const handleLiquidarDeuda = async () => {
    if (!clienteSeleccionado || clienteSeleccionado.saldo_deudor <= 0) return;
    const montoTotal = clienteSeleccionado.saldo_deudor;
    
    // 1. Limpiar saldo del cliente
    const { error: err1 } = await supabase.from('clientes').update({ saldo_deudor: 0 }).eq('id', clienteSeleccionado.id);
    
    if (!err1) {
      // 2. Marcar todos sus pedidos "A Cuenta" como Finalizados
      await supabase.from('pedidos').update({ estado: 'Finalizado' }).eq('cliente_id', clienteSeleccionado.id).eq('metodo_pago', 'A Cuenta');
      
      // 3. Registrar entrada en Dashboard
      await supabase.from('pedidos').insert([{
        telefono_cliente: `LIQUIDACIÓN: ${clienteSeleccionado.nombre}`,
        total: montoTotal,
        estado: 'Pagado',
        origen: 'Mostrador',
        metodo_pago: 'Efectivo',
        cliente_id: clienteSeleccionado.id,
        detalle_pedido: []
      }]);

      setShowAbono(false);
      fetchClientes();
      alert('✅ Cuenta liquidada por completo.');
    }
  };

  if (loading) return <div className="p-10 text-center font-black animate-pulse text-blue-600">ACTUALIZANDO CARTERA...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">Cartera de <span className="text-blue-600">Clientes</span></h2>
        <button onClick={() => setShowAdd(true)} className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase">+ Nuevo Cliente</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientes.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative">
            <div className={`absolute top-0 right-0 w-2 h-full ${c.saldo_deudor > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <h3 className="text-xl font-black text-gray-800 uppercase mb-4">{c.nombre}</h3>
            <div className="bg-gray-50 p-5 rounded-3xl border mb-6">
               <p className="text-[8px] font-black text-gray-400 uppercase">Deuda Pendiente</p>
               <p className={`text-3xl font-black ${c.saldo_deudor > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(c.saldo_deudor)}</p>
            </div>
            <button onClick={() => { setClienteSeleccionado(c); setShowAbono(true); }} className="w-full bg-green-600 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md">💸 Gestionar Pago</button>
          </div>
        ))}
      </div>

      {showAbono && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic mb-6 text-center">{clienteSeleccionado?.nombre}</h3>
            
            <button onClick={handleLiquidarDeuda} className="w-full mb-6 bg-blue-100 text-blue-700 py-4 rounded-2xl font-black text-[10px] uppercase border border-blue-200 hover:bg-blue-600 hover:text-white transition-all">
              🎯 Liquidar Deuda Total ({formatCurrency(clienteSeleccionado?.saldo_deudor)})
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
              <div className="relative flex justify-center text-[8px] uppercase"><span className="bg-white px-2 text-gray-400 font-black">O registra un abono parcial</span></div>
            </div>

            <input type="number" placeholder="MONTO ABONO" className="w-full p-5 rounded-2xl bg-gray-100 font-black text-center text-xl outline-none mb-6" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} />
            
            <button onClick={handleRegistrarAbono} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl mb-4">Confirmar Abono</button>
            <button onClick={() => setShowAbono(false)} className="w-full py-2 font-black uppercase text-[9px] text-gray-400 text-center">Cerrar</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10">
            <h3 className="text-2xl font-black uppercase italic mb-8">Alta Cliente</h3>
            <input placeholder="Nombre" className="w-full p-4 rounded-2xl bg-gray-50 font-bold mb-4" onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} />
            <input placeholder="WhatsApp" className="w-full p-4 rounded-2xl bg-gray-50 font-bold mb-8" onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} />
            <div className="flex gap-4">
               <button onClick={() => setShowAdd(false)} className="flex-1 text-gray-400 font-black uppercase text-[10px]">Cancelar</button>
               <button onClick={handleAddCliente} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px]">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
