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
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '' });

  const fetchClientes = async () => {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('*').order('saldo_deudor', { ascending: false });
    if (data) setClientes(data);
    setLoading(false);
  };

  useEffect(() => { fetchClientes(); }, []);

  const handleAddCliente = async () => {
    if (!nuevoCliente.nombre) return;
    const { error } = await supabase.from('clientes').insert([nuevoCliente]);
    if (!error) {
      setShowAdd(false);
      setNuevoCliente({ nombre: '', telefono: '' });
      fetchClientes();
    }
  };

  // --- FUNCIÓN PARA ABONO PARCIAL ---
  const handleRegistrarAbono = async () => {
    const monto = parseFloat(montoAbono);
    if (isNaN(monto) || !clienteSeleccionado) return;

    // Llamamos a la Joya 2: registrar_abono_cliente
    const { error: errAbono } = await supabase.rpc('registrar_abono_cliente', { 
      cliente_id: clienteSeleccionado.id, 
      monto: monto 
    });

    if (!errAbono) {
      // Creamos un registro en pedidos para que sume al Dashboard de hoy
      await supabase.from('pedidos').insert([{
        telefono_cliente: `ABONO: ${clienteSeleccionado.nombre}`,
        total: monto,
        estado: 'Finalizado',
        origen: 'Mostrador',
        metodo_pago: 'Efectivo',
        cliente_id: clienteSeleccionado.id,
        detalle_pedido: [] 
      }]);

      setShowAbono(false);
      setMontoAbono('');
      fetchClientes();
      alert('✅ Abono registrado. El saldo ha bajado correctamente.');
    }
  };

  // --- FUNCIÓN PARA LIQUIDAR DEUDA COMPLETA ---
  const handleLiquidarDeuda = async () => {
    if (!clienteSeleccionado || clienteSeleccionado.saldo_deudor <= 0) return;
    const montoTotal = clienteSeleccionado.saldo_deudor;

    // 1. Ponemos el saldo en 0 usando la misma función de abono por el total
    const { error: errSaldo } = await supabase.rpc('registrar_abono_cliente', { 
      cliente_id: clienteSeleccionado.id, 
      monto: montoTotal 
    });

    if (!errSaldo) {
      // 2. SINCRONIZACIÓN ATÓMICA: Cerramos todos los pedidos de este cliente en Logística
      await supabase
        .from('pedidos')
        .update({ estado: 'Finalizado' })
        .eq('cliente_id', clienteSeleccionado.id)
        .eq('metodo_pago', 'A Cuenta')
        .neq('estado', 'Finalizado'); 

      // 3. Registro para el Dashboard
      await supabase.from('pedidos').insert([{
        telefono_cliente: `LIQUIDACIÓN: ${clienteSeleccionado.nombre}`,
        total: montoTotal,
        estado: 'Finalizado',
        origen: 'Mostrador',
        metodo_pago: 'Efectivo',
        cliente_id: clienteSeleccionado.id,
        detalle_pedido: []
      }]);

      setShowAbono(false);
      fetchClientes();
      alert(`✅ ¡Reloj Suizo! La cuenta de ${clienteSeleccionado.nombre} está limpia.`);
    }
  };

  if (loading) return <div className="p-10 text-center font-black animate-pulse text-blue-600 uppercase">Sincronizando Cartera Amoree...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 pb-24 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Cartera de <span className="text-blue-600">Clientes</span></h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Control de Cuentas por Cobrar</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">+ Nuevo Cliente</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clientes.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-xl transition-all">
            <div className={`absolute top-0 right-0 w-2 h-full ${c.saldo_deudor > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
            <h3 className="text-xl font-black text-gray-800 uppercase mb-4 leading-none">{c.nombre}</h3>
            <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 mb-6">
               <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Saldo Deudor Actual</p>
               <p className={`text-3xl font-black tracking-tighter ${c.saldo_deudor > 0 ? 'text-red-600' : 'text-green-600'}`}>
                 {formatCurrency(c.saldo_deudor)}
               </p>
            </div>
            <button 
              onClick={() => { setClienteSeleccionado(c); setShowAbono(true); }}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md active:scale-95 transition-all"
            >
              💸 Gestionar Pago
            </button>
          </div>
        ))}
      </div>

      {/* MODAL DE GESTIÓN DE PAGO */}
      {showAbono && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black uppercase italic mb-8 text-center">{clienteSeleccionado?.nombre}</h3>
            
            <button 
              onClick={handleLiquidarDeuda}
              className="w-full mb-6 bg-blue-50 text-blue-700 py-4 rounded-2xl font-black text-[10px] uppercase border border-blue-200 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
            >
              🎯 Liquidar Deuda Total ({formatCurrency(clienteSeleccionado?.saldo_deudor)})
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
              <div className="relative flex justify-center text-[8px] uppercase font-black"><span className="bg-white px-3 text-gray-400 tracking-widest">O registrar abono</span></div>
            </div>

            <input 
              type="number" placeholder="¿CUÁNTO ABONA?"
              className="w-full p-5 rounded-2xl bg-gray-100 font-black text-center text-xl outline-none focus:ring-4 focus:ring-blue-100 mb-6 transition-all"
              value={montoAbono}
              onChange={e => setMontoAbono(e.target.value)}
            />
            
            <div className="flex flex-col gap-3">
               <button onClick={handleRegistrarAbono} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Confirmar Abono</button>
               <button onClick={() => setShowAbono(false)} className="w-full py-2 font-black uppercase text-[9px] text-gray-400 text-center">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic mb-8">Alta de Cliente</h3>
            <div className="space-y-4">
              <input placeholder="Nombre Completo" className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0 outline-none" onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} />
              <input placeholder="Teléfono" className="w-full p-4 rounded-2xl bg-gray-50 font-bold border-0 outline-none" onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-8">
               <button onClick={() => setShowAdd(false)} className="flex-1 text-gray-400 font-black uppercase text-[10px]">Cerrar</button>
               <button onClick={handleAddCliente} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-blue-100">Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
