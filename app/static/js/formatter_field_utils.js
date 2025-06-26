document.addEventListener("DOMContentLoaded", function () {
    const inputValor = document.getElementById("valor");
  
    inputValor.addEventListener("input", function (e) {
      let valor = e.target.value;
  
      // Remove tudo que não for número
      valor = valor.replace(/\D/g, "");
  
      // Converte para centavos e formata
      valor = (parseInt(valor, 10) / 100).toFixed(2);
  
      // Troca ponto por vírgula
      valor = valor.replace(".", ",");
  
      e.target.value = valor;
    });
  });
