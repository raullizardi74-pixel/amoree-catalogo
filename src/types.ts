export interface Product {
  id: number;
  SKU: string;
  nombre: string;
  precio_venta: number;
  unidad: string;
  url_imagen: string;
  categoria: string;
  '$ VENTA': number; 
  'IMAGEN URL': string;
  Artículo: string;
  Unidad: string;
  Categoría: string;
}

export interface CartItem extends Product {
  quantity: number;
}
