-- Synthetic payment history for demonstrating the statistics dashboard.
-- Every invoice uses a DEMO number and is attached only to demo customers.
INSERT INTO clientes (
  cedula_rif, nombre_razon_social, telefono, direccion,
  limite_credito, dias_credito_otorgados
)
VALUES (
  'V-00000003', 'Cliente de prueba Tres', '+58 412 000 0003',
  'Dirección de prueba, Valencia', 400.00, 20
)
ON DUPLICATE KEY UPDATE cedula_rif = VALUES(cedula_rif);

CREATE TEMPORARY TABLE historial_pago_demo (
  cedula_rif VARCHAR(20) NOT NULL,
  numero_factura VARCHAR(50) NOT NULL,
  codigo_producto VARCHAR(40) NOT NULL,
  cantidad INT UNSIGNED NOT NULL,
  dias_vencimiento INT UNSIGNED NOT NULL,
  dias_pago_despues_vencimiento INT NOT NULL,
  dias_llamada_respecto_vencimiento INT NULL
);

INSERT INTO historial_pago_demo
  (cedula_rif, numero_factura, codigo_producto, cantidad, dias_vencimiento,
   dias_pago_despues_vencimiento, dias_llamada_respecto_vencimiento)
VALUES
  ('V-00000001', 'DEMO-HIST-20261021-01', 'DEMO-001', 2, 45, -3, NULL),
  ('V-00000001', 'DEMO-HIST-20261021-02', 'DEMO-002', 1, 25, -1, NULL),
  ('J-00000002', 'DEMO-HIST-20261021-03', 'DEMO-001', 1, 40, -1, -4),
  ('J-00000002', 'DEMO-HIST-20261021-04', 'DEMO-002', 1, 32, 5, 2),
  ('V-00000003', 'DEMO-HIST-20261021-05', 'DEMO-001', 1, 65, 3, NULL),
  ('V-00000003', 'DEMO-HIST-20261021-06', 'DEMO-002', 1, 18, 8, NULL);

START TRANSACTION;

INSERT INTO facturas_venta (
  cliente_id, numero_factura, monto_total, saldo_pendiente,
  fecha_emision, fecha_vencimiento, estatus_pago
)
SELECT c.id, d.numero_factura, ROUND(p.precio_bs * d.cantidad, 2), 0,
       DATE_SUB(DATE_SUB(CURRENT_DATE, INTERVAL d.dias_vencimiento DAY), INTERVAL 30 DAY),
       DATE_SUB(CURRENT_DATE, INTERVAL d.dias_vencimiento DAY),
       'PAGADO'
FROM historial_pago_demo d
JOIN clientes c ON c.cedula_rif = d.cedula_rif
JOIN productos p ON p.codigo = d.codigo_producto AND p.activo = 1
WHERE c.nombre_razon_social LIKE 'Cliente de prueba%'
  AND NOT EXISTS (
    SELECT 1 FROM facturas_venta existing
    WHERE existing.numero_factura = d.numero_factura
  );

INSERT INTO abonos_facturas (factura_id, monto, fecha_abono)
SELECT f.id, f.monto_total,
       TIMESTAMP(DATE_ADD(
         f.fecha_vencimiento,
         INTERVAL d.dias_pago_despues_vencimiento DAY
       ))
FROM historial_pago_demo d
JOIN facturas_venta f ON f.numero_factura = d.numero_factura
WHERE NOT EXISTS (
  SELECT 1 FROM abonos_facturas existing WHERE existing.factura_id = f.id
);

INSERT INTO recordatorios_pago (factura_id, fecha_recordatorio)
SELECT f.id,
       TIMESTAMP(DATE_ADD(
         f.fecha_vencimiento,
         INTERVAL d.dias_llamada_respecto_vencimiento DAY
       ))
FROM historial_pago_demo d
JOIN facturas_venta f ON f.numero_factura = d.numero_factura
WHERE d.dias_llamada_respecto_vencimiento IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM recordatorios_pago existing WHERE existing.factura_id = f.id
  );

COMMIT;
DROP TEMPORARY TABLE historial_pago_demo;
