// ... (mismo inicio de componente)

  // --- LÓGICA DE WHATSAPP CON RESPETO A LA PRIVACIDAD ---
  const enviarTicketDigitalWA = async (order: any) => {
    let telefono = order.telefono_cliente?.match(/(\d{10})/)?.[1];
    let nombre = order.nombre_cliente || 'Cliente';
    let esAnonimo = !order.nombre_cliente || order.nombre_cliente === 'Venta Local';

    // Si es anónimo, intentamos capturar, pero permitimos ESCAPAR
    if (esAnonimo && !telefono) {
      const inputNombre = prompt("👤 Nombre (Opcional - Cancelar para mantener anónimo):");
      
      // Si el usuario cancela el primer prompt, respetamos la privacidad y salimos del flujo de registro
      if (inputNombre === null) {
        // Aún así, quizás quiera el ticket sin registrarse. Preguntamos solo el número.
        const soloTel = prompt("📱 Solo WhatsApp para enviar ticket (Opcional):");
        if (soloTel && soloTel.length === 10) {
          telefono = soloTel;
        } else {
          return; // Si no quiere dar ni el número, cerramos el flujo.
        }
      } else {
        // Si dio el nombre, pedimos el teléfono para registrarlo como socio
        const inputTel = prompt("📱 WhatsApp para registro de Socio (10 dígitos):");
        
        if (inputNombre && inputTel && inputTel.length === 10) {
          nombre = inputNombre.toUpperCase();
          telefono = inputTel;

          // REGISTRO VOLUNTARIO EN BASE DE DATOS
          try {
            await supabase.from('clientes').insert([{ 
              nombre: nombre, 
              telefono: telefono, 
              saldo_deudor: 0 
            }]);
            await supabase.from('pedidos').update({ 
              nombre_cliente: nombre,
              telefono_cliente: telefono
            }).eq('id', order.id);
            fetchOrders();
          } catch (e) { console.error("Error al registrar socio", e); }
        }
      }
    }

    // GENERACIÓN DEL MENSAJE (Sea anónimo o registrado)
    const fecha = format(new Date(order.created_at), 'dd/MM/yyyy HH:mm');
    const items = order.detalle_pedido?.map((i: any) => 
      `• ${i.nombre}: ${i.quantity}${i.unidad || 'kg'} = *${formatCurrency(i.quantity * (i.precio_venta || i['$ VENTA']))}*`
    ).join('%0A');

    const mensaje = `*AMOREE - Recibo Digital* 🥑%0A` +
                    `--------------------------%0A` +
                    `¡Hola! Gracias por tu compra.%0A` +
                    `*Folio:* #${order.id}%0A` +
                    `*Fecha:* ${fecha}%0A` +
                    `--------------------------%0A` +
                    items +
                    `%0A--------------------------%0A` +
                    `*TOTAL: ${formatCurrency(order.total)}*%0A` +
                    `*Pago:* ${order.metodo_pago || 'Efectivo'}%0A` +
                    `--------------------------%0A` +
                    `¡Nos vemos pronto! 🚀`;

    window.open(`https://wa.me/52${telefono}?text=${mensaje}`, '_blank');
  };

// ... (resto del componente se mantiene igual)
