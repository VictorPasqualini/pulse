import axios from "axios";
// Durante o dev, use o IP da sua máquina na rede LAN (ex.: 192.168.0.10)
export const api = axios.create({ baseURL: "http://192.168.0.30:3333" });