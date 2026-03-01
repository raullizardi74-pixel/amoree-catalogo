// 1. Agregamos el estado para el costo y el margen
const [newCosto, setNewCosto] = useState(product.costo || 0);
const MARGEN = 1.20; // 20% de utilidad

// 2. Función para manejar el cambio de costo y sugerir precio
const handleCostoChange = (valor: string) => {
  const costoNum = parseFloat(valor) || 0;
  setNewCosto(costoNum);
  // Sugerimos el precio de venta automáticamente
  setNewPrice((costoNum * MARGEN).toFixed(2));
};

// 3. Actualizamos la función de guardado en Supabase
const handleUpdatePrice = async () => {
  try {
    const { error } = await supabase
      .from('productos')
      .update({ 
        costo: newCosto, 
        precio_venta: parseFloat(newPrice) 
      })
      .eq('sku', currentSku);
      
    if (error) throw error;
    setIsEditing(false);
    window.location.reload();
  } catch (e) {
    alert('Error al guardar datos');
  }
};

// --- En el diseño (JSX) dentro del bloque de isAdmin ---
{isEditing ? (
  <div className="bg-blue-50 p-2 rounded-xl space-y-2 border border-blue-100">
    <div>
      <label className="text-[9px] font-black text-blue-800 uppercase">Costo ($)</label>
      <input 
        type="number" 
        value={newCosto} 
        onChange={(e) => handleCostoChange(e.target.value)} 
        className="w-full border rounded-lg px-2 py-1 font-bold text-sm" 
      />
    </div>
    <div>
      <label className="text-[9px] font-black text-green-800 uppercase">Venta Sugerida (+20%)</label>
      <input 
        type="number" 
        value={newPrice} 
        onChange={(e) => setNewPrice(e.target.value)} 
        className="w-full border-2 border-green-400 rounded-lg px-2 py-1 font-black text-green-700 text-sm" 
      />
    </div>
    <button onClick={handleUpdatePrice} className="w-full bg-blue-600 text-white font-bold py-1 rounded-lg text-xs">
      GUARDAR CAMBIOS
    </button>
  </div>
) : (
  // ... mostrar precio actual como siempre
)}
