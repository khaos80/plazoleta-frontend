USE plazoleta_pedidos;
CREATE TABLE IF NOT EXISTS pedidos (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 cliente_id BIGINT NOT NULL,
 restaurante_id BIGINT NOT NULL,
 estado ENUM('PENDIENTE','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO') NOT NULL,
 empleado_asignado BIGINT,
 pin_seguridad VARCHAR(6),
 INDEX idx_pedido_cliente_estado (cliente_id, estado)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS detalles_pedido (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 pedido_id BIGINT NOT NULL,
 plato_id BIGINT NOT NULL,
 cantidad INT NOT NULL,
 CONSTRAINT uk_pedido_plato UNIQUE (pedido_id, plato_id),
 CONSTRAINT fk_detalles_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS pedido_estado_historial (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 pedido_id BIGINT NOT NULL,
 estado_anterior ENUM('PENDIENTE','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO'),
 estado_nuevo ENUM('PENDIENTE','EN_PREPARACION','LISTO','ENTREGADO','CANCELADO') NOT NULL,
 fecha_cambio DATETIME(6) NOT NULL,
 INDEX idx_historial_pedido_fecha (pedido_id, fecha_cambio)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS bloqueos_cliente (
 cliente_id BIGINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
