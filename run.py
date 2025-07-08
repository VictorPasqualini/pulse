from flask import Flask, request, render_template, redirect, url_for, session, flash
import app as persist_table
import app as login_utils
import pymysql

pymysql.install_as_MySQLdb()
app = Flask(__name__)
app.secret_key = 'alguma_coisa_bem_secreta'

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/form_register")
def form_register():
    return render_template("form_register.html")

@app.route("/form_controle_financa")
def form_controle_financa():
    if "usuario_id" not in session:
        flash("Você precisa estar logado.")
        return redirect(url_for("index"))
    return render_template("form_controle_financa.html", nome=session["usuario_nome"])

@app.route("/logout")
def logout():
    session.clear()
    flash("Você saiu com sucesso.")
    return redirect(url_for("index"))

@app.route("/save_usuario", methods=["POST"])
def save_usuario():
    if request.method == "POST": 
        dados = {
            "email": request.form["email"],
            "senha": request.form["senha"],
            "nome": request.form["nome"],
            "telefone": request.form["telefone"],
            "documento": request.form["documento"]
        }

        sucesso = persist_table.persist_usuario(dados)
        if sucesso:
            flash("Cadastro realizado com sucesso! Faça login.")
            return redirect(url_for("index"))
        else:
            flash("Erro ao cadastrar. Email já pode estar em uso.")
            return redirect(url_for("form_register"))
        
    return render_template("cadastro.html")

@app.route("/save_controle_financa", methods=["POST"])
def save_controle_financa():
    dados = {
        "valor": request.form["valor"],
        "tipo": request.form["tipo"],
        "descricao": request.form["descricao"],
        "data": request.form["data"]
    }

    sucesso = persist_table.persist_controle_financa(dados)
    if sucesso:
        flash("Transação salva com sucesso!")
        return redirect(url_for("form_controle_financa"))
    else:
        flash("Erro ao salvar transação.")
        return redirect(url_for("form_controle_financa"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        dados = {
           "email": request.form["email"],
           "senha": request.form["senha"]
        }
        
        usuario = login_utils.check_login(dados) 
        if usuario:
            session["usuario_id"] = usuario["id"]
            session["usuario_email"] = usuario["email"]
            session["usuario_nome"] = usuario["nome"]
            flash("Login realizado com sucesso!") 
            return redirect(url_for("form_controle_financa"))
        else:
            flash("E-mail ou senha incorretos, ou cadastro não encontrado.")
            return redirect(url_for("index"))

if __name__ == "__main__":
    app.run(debug=True)
