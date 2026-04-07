// ... (mismos imports que ya teníamos)

  // ✅ CORRECCIÓN RADAR: Consulta atómica con Join para la fecha
  const fetchHistory = async (sku: string) => {
    // Buscamos en compras_detalle y pedimos la fecha de la tabla compras (join)
    const { data, error } = await supabase
      .from('compras_detalle')
      .select(`
        costo_unitario,
        compras!inner(created_at)
      `)
      .eq('sku', sku)
      .order('id', { ascending: false }) // Los más nuevos primero
      .limit(3);

    if (data) {
      // Re-formateamos la data para que sea fácil de leer en el historial
      const formatted = data.map((h: any) => ({
        costo_unitario: h.costo_unitario,
        created_at: h.compras.created_at
      }));
      setCostHistory(formatted);
    } else {
      setCostHistory([]);
    }
  };

  // Se mantienen todas las funciones premium (Botones KPI, Snowflake, Misión, etc.)
  // ... (Pega aquí el resto del InventoryModule.tsx de la respuesta anterior)

  // ✅ FICHA RADAR CON DATOS VISIBLES (Asegúrate que este bloque esté así)
  {isEditing && (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
       <div className="bg-[#0A0A0A] border border-white/10 rounded-[50px] p-8 w-full max-w-lg relative animate-in zoom-in duration-300 shadow-3xl">
          <button onClick={() => setIsEditing(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white transition-colors"><X/></button>
          <h3 className="text-2xl font-black uppercase italic mb-8 text-green-500 tracking-tighter">Radar de Producto</h3>
          
          <div className="space-y-6">
             <div className="flex gap-4 bg-black p-4 rounded-3xl border border-white/5">
                <img src={formData.url_imagen} className="w-20 h-20 rounded-2xl object-cover" />
                <div><p className="text-xl font-black uppercase leading-none">{formData.nombre}</p><p className="text-[9px] font-black text-gray-500 mt-2 italic">SKU: {formData.sku}</p></div>
             </div>

             {/* 📉 HISTORIAL DE COSTOS (RESTURADO) */}
             <div className="bg-white/[0.02] p-5 rounded-3xl border border-white/5">
                <p className="text-[8px] font-black text-green-500 uppercase mb-4 flex items-center gap-2 tracking-widest"><History size={10}/> Historial de Compras</p>
                <div className="space-y-3">
                  {costHistory.length > 0 ? costHistory.map((h, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] font-black border-b border-white/5 pb-2">
                      <span className="text-gray-500">{format(new Date(h.created_at), 'dd MMM yy')}</span>
                      <span className="text-white font-bold">{formatCurrency(h.costo_unitario)}</span>
                    </div>
                  )) : <p className="text-[10px] text-gray-600 italic">Sin registros en 'compras_detalle'.</p>}
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="bg-black p-5 rounded-3xl border border-white/5">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Costo Actual</label>
                  <p className="text-2xl font-black text-white">{formatCurrency(formData.costo)}</p>
                </div>
                <div className="bg-black p-5 rounded-3xl border border-white/5">
                  <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Existencia</label>
                  <p className="text-2xl font-black text-green-500">{Number(formData.stock_actual?.toFixed(3))} <span className="text-xs uppercase">{formData.unidad}</span></p>
                </div>
             </div>

             <button onClick={() => setIsEditing(false)} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Cerrar Radar</button>
          </div>
       </div>
    </div>
  )}
