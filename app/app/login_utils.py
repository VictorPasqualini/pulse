import hashlib
import pymysql

def check_login(dados):
    email = dados["email"]
    senha = dados["senha"]
    senha_criptografada = hashlib.sha256(senha.encode()).hexdigest()

    db = pymysql.connect(
        host="localhost",
        user="root",
        password="Stefany2311",
        database="financa",
        port=3306
    )

    cursor = db.cursor(pymysql.cursors.DictCursor)
    cursor.execute("SELECT * FROM usuario WHERE email = %s AND senha = %s", (email, senha_criptografada))
    usuario = cursor.fetchone()
    cursor.close()
    db.close()

    return usuario
