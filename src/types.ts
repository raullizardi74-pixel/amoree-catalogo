export interface Product {
  sku: string;         // Usamos sku en minúsculas para coincidir con Supabase
  SKU?: string;        // Mantenemos este por si acaso hay datos viejos
  nombre: string;
  precio_venta: number; // Este acepta decimales (ej: 35.50)
  unidad: string;
  url_imagen: string;
  categoria?: string;
}

export interface CartItem extends Product {
  quantity: number;    // ¡AQUÍ ESTÁ LA CLAVE! Este ahora aceptará 0.25, 0.50, etc.
}

export interface Order {
  id?: number;
  created_at?: string;
  telefono_cliente: string;
  usuario_email: string;
  detalle_pedido: CartItem[];
  total: number;
  estado: 'Pendiente' | 'Entregado' | 'Pagado' | 'Cancelado';
}
