function toggleSenha(campoId, botao) {
    const campo = document.getElementById(campoId);
    if (campo.type === "password") {
		campo.type = "text";
		botao.innerText = "👁️";
    } else {
		campo.type = "password";
		botao.innerText = "👁️";
    }
}