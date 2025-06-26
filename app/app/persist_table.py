from datetime import datetime
import hashlib
import pymysql

def persist_controle_financa(dados):
    try:

        valor = float(dados["valor"].replace(",", "."))
        tipo = dados["tipo"]
        descricao = dados["descricao"] 
        data = dados["data"]

        data = datetime.strptime(data, "%Y-%m-%d").date()

        db = pymysql.connect(
            host="localhost",
            user="root",
            password="Stefany2311",
            database="financa",
            port="3306"
        )

        cursor = db.cursor()
        sql = "INSERT INTO controle_transacao (valor, tipo, descricao, data_inclusao) VALUES (%s, %s, %s, %s)"
        cursor.execute(sql, (valor, tipo, descricao, data))
        db.commit()
        cursor.close()
        db.close()
        return True
    
    except Exception as e:
        print("Erro:", e)
        return False

def persist_usuario(dados):
    try: 
        email = dados["email"]
        senha = dados["senha"]
        nome = dados["nome"]
        telefone = dados["telefone"]
        documento = dados["documento"]
        senha_criptografada = hashlib.sha256(senha.encode()).hexdigest()

        conn = pymysql.connect(
            host="localhost",
            user="root",
            password="Stefany2311",
            database="financa",
            port=3306
        )

        cursor = conn.cursor(pymysql.cursors.DictCursor)
        sql = "INSERT INTO usuario (email, senha, nome, telefone, documento) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(sql, (email, senha_criptografada, nome, telefone, documento))
        conn.commit()

        cursor.close()
        conn.close()
        return True

    except pymysql.Error as err:
        print("Erro ao cadastrar:", err)
        return False
