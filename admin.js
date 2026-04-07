const form = document.getElementById('form-cadastro');

form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Pegando os valores dos campos
    const nome = document.getElementById('nome-brinquedo').value;
    const descricao = document.getElementById('descricao-brinquedo').value;
    const valor = document.getElementById('valor-brinquedo').value;
    const whatsapp = document.getElementById('whatsapp-dono').value;

    // Criando o objeto no Firebase
    database.ref('produtos').push({
        nome: nome,
        descricao: descricao,
        valor: valor,
        whatsapp: whatsapp,
        dataCadastro: new Date().toISOString(),
        cidade: "Contagem",
        status: "ativo" // Para podermos desativar se o brinquedo estragar
    })
    .then(() => {
        alert("Sucesso! Seu brinquedo já está no Portal de Contagem.");
        form.reset(); // Limpa o formulário
    })
    .catch((error) => {
        console.error("Erro ao cadastrar:", error);
        alert("Ops! Algo deu errado. Verifique as regras do Firebase.");
    });
});
