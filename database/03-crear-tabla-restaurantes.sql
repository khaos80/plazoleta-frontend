USE plazoleta_restaurantes;
CREATE TABLE IF NOT EXISTS restaurantes (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(255) NOT NULL,
 nit VARCHAR(255) NOT NULL,
 direccion VARCHAR(255) NOT NULL,
 telefono VARCHAR(13) NOT NULL,
 url_logo VARCHAR(255) NOT NULL,
 propietario_id BIGINT NOT NULL,
 CONSTRAINT uk_restaurantes_nit UNIQUE (nit),
 CONSTRAINT uk_restaurantes_propietario UNIQUE (propietario_id)
) ENGINE=InnoDB;
