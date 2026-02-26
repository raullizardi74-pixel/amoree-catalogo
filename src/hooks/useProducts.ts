import { useState, useEffect } from 'react';
import { Product } from '../types';
import { supabase } from '../lib/supabase';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('productos')
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          throw error;
        }

        const mappedProducts = data.map((p: any) => ({
          ...p,
          SKU: p.sku,
          Artículo: p.nombre,
          '$ VENTA': p.precio_venta,
          Unidad: p.unidad,
          'IMAGEN URL': p.url_imagen,
          Categoría: p.categoria,
        }));

        setProducts(mappedProducts);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred while fetching products'));
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  return { products, loading, error };
}

