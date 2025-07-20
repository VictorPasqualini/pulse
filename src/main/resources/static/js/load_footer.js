fetch('includes/footer.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('footer').innerHTML = data;
    
    })
    .catch(error => console.error('Erro ao carregar footer:', error));