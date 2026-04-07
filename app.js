// Referência da div onde os brinquedos vão aparecer
const listaBrinquedos = document.getElementById('lista-brinquedos');

// Função para buscar e exibir os produtos
function carregarProdutos() {
    // Escuta em tempo real a pasta 'produtos'
    database.ref('produtos').on('value', (snapshot) => {
        listaBrinquedos.innerHTML = ""; // Limpa a tela antes de carregar

        const dados = snapshot.val();

        if (!dados) {
            listaBrinquedos.innerHTML = "<p class='aviso'>Nenhum brinquedo disponível em Contagem no momento.</p>";
            return;
        }

        // Transforma o objeto do Firebase em uma lista e percorre cada item
        Object.keys(dados).forEach((id) => {
            const produto = dados[id];

            // Criando o HTML do Card
            const card = `
                <div class="card-produto">
                    <div class="info">
                        <h3>${produto.nome}</h3>
                        <p class="descricao">${produto.descricao}</p>
                        <p class="preco">Sugerido: <strong>R$ ${produto.valor}</strong></p>
                        <p class="local">📍 ${produto.cidade}</p>
                        
                        <a href="https://wa.me/55${produto.whatsapp}?text=Olá! Vi o seu ${produto.nome} no Portal Festas Contagem e gostaria de saber a disponibilidade para minha festa!" 
                           target="_blank" class="btn-reservar">
                           💬 Consultar Disponibilidade
                        </a>
                    </div>
                </div>
            `;

            listaBrinquedos.innerHTML += card;
        });
    });
}

// Inicia a busca assim que a página carrega
carregarProdutos();
