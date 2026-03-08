import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

export default function ClientsModule() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); // Estado para el buscador
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

  const handleRegistrarAbono = async () => {
    const monto = parseFloat(montoAbono);
    if (isNaN(monto) || !clienteSeleccionado) return;

    const { error: errAbono } = await supabase.rpc('registrar_abono_cliente', { 
      cliente_id: clienteSeleccionado.id, 
      monto: monto 
    });

    if (!errAbono) {
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
      alert('✅ Abono registrado con éxito.');
    }
  };

  const handleLiquidarDeuda = async () => {
    if (!clienteSeleccionado || clienteSeleccionado.saldo_deudor <= 0) return;
    const montoTotal = clienteSeleccionado.saldo_deudor;

    const { error: errSaldo } = await supabase.rpc('registrar_abono_cliente', { 
      cliente_id: clienteSeleccionado.id, 
      monto: montoTotal 
    });

    if (!errSaldo) {
      await supabase
        .from('pedidos')
        .update({ estado: 'Finalizado' })
        .eq('cliente_id', clienteSeleccionado.id)
        .eq('metodo_pago', 'A Cuenta')
        .neq('estado', 'Finalizado'); 

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
      alert(`✅ Cuenta de ${clienteSeleccionado.nombre} liquidada.`);
    }
  };

  // Filtrado lógico de clientes
  const clientesFiltrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center font-black animate-pulse text-green-500 uppercase tracking-widest">Sincronizando Cartera Titanium...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-10 space-y-10 pb-32 animate-in fade-in duration-700">
      
      {/* HEADER CON BUSCADOR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
        <div className="space-y-2">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter leading-none">
            Cartera de <span className="text-green-500">Clientes</span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Control de Activos por Cobrar</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-4 items-center">
          {/* BUSCADOR DE PRECISIÓN */}
          <div className="relative w-full sm:w-80 group">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-green-500 transition-colors">🔍</span>
            <input 
              type="text" 
              placeholder="BUSCAR CLIENTE..." 
              className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl font-black text-[11px] tracking-widest outline-none focus:ring-2 focus:ring-green-500/30 focus:bg-white/10 transition-all uppercase"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={() => setShowAdd(true)} 
            className="w-full sm:w-auto bg-white text-black px-8 py-4 rounded-[20px] font-black text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all"
          >
            + Nuevo Registro
          </button>
        </div>
      </div>

      {/* GRID DE CARTERA FILTRADA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {clientesFiltrados.length > 0 ? (
          clientesFiltrados.map(c => (
            <div key={c.id} className="bg-[#0A0A0A] p-8 rounded-[45px] border border-white/5 relative overflow-hidden group hover:border-green-500/30 transition-all shadow-2xl">
              <div className={`absolute top-0 right-0 w-1.5 h-full ${c.saldo_deudor > 0 ? 'bg-red-500/50' : 'bg-green-500/50'}`}></div>
              
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter max-w-[70%]">{c.nombre}</h3>
                <span className="text-[8px] font-black bg-white/5 px-3 py-1 rounded-full text-gray-500 uppercase">ID-{String(c.id).slice(0,4)}</span>
              </div>

              <div className="bg-white/[0.02] p-6 rounded-[30px] border border-white/5 mb-8">
                 <p className="text-[8px] font-black text-gray-600 uppercase mb-2 tracking-widest">Saldo Deudor</p>
                 <p className={`text-4xl font-black tracking-tighter ${c.saldo_deudor > 0 ? 'text-red-500' : 'text-green-500'}`}>
                   {formatCurrency(c.saldo_deudor)}
                 </p>
              </div>

              <button 
                onClick={() => { setClienteSeleccionado(c); setShowAbono(true); }}
                className="w-full bg-white/5 hover:bg-green-600 hover:text-white py-5 rounded-[22px] font-black text-[10px] uppercase tracking-[0.2em] border border-white/10 transition-all group-hover:shadow-[0_10px_30px_rgba(34,197,94,0.2)]"
              >
                💸 Gestionar Cobro
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-gray-600 font-black uppercase text-xs tracking-[0.5em]">No se encontraron socios con ese nombre</p>
          </div>
        )}
      </div>

      {/* MODAL GESTIÓN DE PAGO */}
      {showAbono && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[150] flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] w-full max-w-md rounded-[55px] p-12 border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300">
            <p className="text-[9px] font-black text-green-500 uppercase text-center mb-2 tracking-[0.5em]">Operación de Caja</p>
            <h3 className="text-3xl font-black uppercase text-white mb-10 text-center tracking-tighter">{clienteSeleccionado?.nombre}</h3>
            
            <button 
              onClick={handleLiquidarDeuda}
              className="w-full mb-8 bg-green-600/10 text-green-500 py-6 rounded-[28px] font-black text-[11px] uppercase border border-green-500/30 hover:bg-green-600 hover:text-white transition-all shadow-lg active:scale-95"
            >
              🎯 Liquidar Total: {formatCurrency(clienteSeleccionado?.saldo_deudor)}
            </button>

            <div className="relative mb-8 flex justify-center">
              <span className="bg-[#0F0F0F] px-4 text-[8px] uppercase font-black text-gray-600 tracking-[0.3em] z-10">O Abono Parcial</span>
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5"></div>
            </div>

            <div className="relative mb-8">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-green-500 opacity-50">$</span>
              <input 
                type="number" placeholder="0.00"
                className="w-full p-7 rounded-[28px] bg-white/5 border border-white/10 font-black text-center text-3xl text-green-500 outline-none focus:ring-4 focus:ring-green-500/10 transition-all"
                value={montoAbono}
                onChange={e => setMontoAbono(e.target.value)}
              />
            </div>
            
            <div className="space-y-4">
               <button onClick={handleRegistrarAbono} className="w-full bg-white text-black py-6 rounded-[28px] font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">Sellar Abono</button>
               <button onClick={() => {setShowAbono(false); setMontoAbono('');}} className="w-full py-2 font-black uppercase text-[9px] text-gray-700 tracking-widest hover:text-white transition-colors">Abortar Operación</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[140] flex items-center justify-center p-4">
          <div className="bg-[#0F0F0F] w-full max-w-md rounded-[50px] p-12 border border-white/10 shadow-2xl">
            <h3 className="text-3xl font-black uppercase mb-10 tracking-tighter text-center">Nuevo <span className="text-green-500">Socio</span></h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="ml-4 text-[8px] font-black text-gray-600 uppercase">Identificación</p>
                <input placeholder="NOMBRE COMPLETO" className="w-full p-6 rounded-[22px] bg-white/5 border border-white/10 font-black text-xs text-white uppercase outline-none focus:border-green-500/50" onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} />
              </div>
              <div className="space-y-2">
                <p className="ml-4 text-[8px] font-black text-gray-600 uppercase">Contacto</p>
                <input placeholder="TELÉFONO / WHATSAPP" className="w-full p-6 rounded-[22px] bg-white/5 border border-white/10 font-black text-xs text-white outline-none focus:border-green-500/50" onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} />
              </div>
            </div>
            <div className="flex flex-col gap-4 mt-12">
               <button onClick={handleAddCliente} className="w-full bg-green-600 text-white py-6 rounded-[25px] font-black uppercase text-xs tracking-widest shadow-lg shadow-green-900/20 active:scale-95 transition-all">Guardar en Cartera</button>
               <button onClick={() => setShowAdd(false)} className="w-full py-2 text-gray-600 font-black uppercase text-[9px] tracking-widest">Regresar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
