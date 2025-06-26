CREATE TABLE controle_transacao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  descricao VARCHAR(100) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  tipo ENUM('ENTRADA', 'SAIDA') NOT NULL,
  data_inclusao DATE NOT NULL
);