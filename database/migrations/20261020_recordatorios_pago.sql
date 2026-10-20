CREATE TABLE IF NOT EXISTS abonos_facturas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  factura_id BIGINT UNSIGNED NOT NULL,
  monto DECIMAL(14, 2) NOT NULL,
  fecha_abono TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_abono_factura_monto CHECK (monto > 0),
  CONSTRAINT fk_abono_factura FOREIGN KEY (factura_id)
    REFERENCES facturas_venta(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_abonos_factura (factura_id, fecha_abono)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recordatorios_pago (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  factura_id BIGINT UNSIGNED NOT NULL,
  fecha_recordatorio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_recordatorios_pago_factura FOREIGN KEY (factura_id)
    REFERENCES facturas_venta(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_recordatorios_pago_factura (factura_id, fecha_recordatorio)
) ENGINE=InnoDB;
