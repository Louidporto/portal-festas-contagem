// --- 1. CONTROLE DE INTERFACE (ABAS E MODAL) ---
function abrirAba(evt, nomeAba) {
    const conteudos = document.getElementsByClassName("tab-content");
    for (let i = 0; i < conteudos.length; i++) {
        conteudos[i].style.display = "none";
    }
    // Remove a classe "active" de todos os botões
    const botoes = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < botoes.length; i++) {
        botoes[i].classList.remove("active");
    }

    // Mostra a aba atual e marca o botão como ativo
    document.getElementById(nomeAba).style.display = "block";
    evt.currentTarget.classList.add("active");

    // Chamadas de carregamento independentes
        if(nomeAba === 'aba-solicitacoes') carregarSolicitacoes();
        if(nomeAba === 'aba-historico') carregarHistorico();
}

function abrirModal() {
    const m = document.getElementById('modal-cadastro');
    m.style.setProperty('display', 'block', 'important');
}

function fecharModal() {
    const m = document.getElementById('modal-cadastro');
    m.style.setProperty('display', 'none', 'important');
}

// --- 2. GESTÃO DE PRODUTOS ---
function carregarProdutos() {
    const grid = document.getElementById('grid-produtos');
    database.ref('produtos').on('value', (snapshot) => {
        grid.innerHTML = "";
        const dados = snapshot.val();
        if (!dados) return;

        Object.keys(dados).forEach(id => {
            const p = dados[id];
            const img = p.imagem ? p.imagem.split(',')[0] : 'https://via.placeholder.com/300x200';
            
            grid.innerHTML += `
            <div class="card-padrao">
                <img src="${img}" class="img-card">
                <div class="conteudo-card">
                    <div style="display:flex; justify-content:space-between; align-items: center;">
                        <h3 style="color: var(--primary-blue);">${p.nome}</h3>
                        <button class="btn-lixo" onclick="excluirItem('produtos/${id}')"><i class="fas fa-trash"></i></button>
                    </div>
                    <p class="desc-curta" style="font-size: 0.85rem; color: #666; margin-bottom: 10px;">${p.descricao || ""}</p>
                    
                    <div class="detalhes-info">
                        <p><i class="fas fa-tag"></i> <strong>Valor:</strong> R$ ${p.valor || "0,00"}</p>
                        <p><i class="fab fa-whatsapp"></i> <strong>Contato:</strong> ${p.whatsapp || ""}</p>
                    </div>
                </div>
            </div>`;
        });
    });
}

// --- 3. GESTÃO DE AGENDA ---
function carregarAgenda() {
    const grid = document.getElementById('grid-reservas');
    database.ref('agendamentos').on('value', snapAgendas => {
        grid.innerHTML = "";
        const agendas = snapAgendas.val();
        if(!agendas) return grid.innerHTML = "<p class='aviso'>Nenhuma reserva ativa.</p>";

        database.ref('produtos').once('value', snapProd => {
            const prods = snapProd.val();
            Object.keys(agendas).forEach(idReserva => {
                const res = agendas[idReserva];
                const p = prods ? prods[res.produto_id] : null;
                const img = p && p.imagem ? p.imagem.split(',')[0] : 'https://via.placeholder.com/300x200';

                const dIni = res.data_inicio.split('-').reverse().join('/');
                const dFim = res.data_fim.split('-').reverse().join('/');

                grid.innerHTML += `
                <div class="card-padrao">
                    <img src="${img}" class="img-card">
                    <div class="conteudo-card">
                        <h3>${p ? p.nome : "Item Removido"}</h3>
                        
                        <div class="detalhes-info">
                            <p><i class="fas fa-user"></i> <strong>${res.cliente || "Bloqueio Manual"}</strong></p>
                            <p><i class="fas fa-calendar-alt"></i> ${dIni} até ${dFim}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${res.endereco || "N/A"}</p>
                            <p><i class="fab fa-whatsapp"></i> ${res.telefone || "N/A"}</p>
                        </div>

                        <div class="acoes-card">
                            <button onclick="liberarEFinalizar('${idReserva}', '${res.solicitacao_id || ''}')" class="btn-confirmar" style="width: 100%;">
                                <i class="fas fa-check-double"></i> Finalizar Locação
                            </button>
                        </div>
                    </div>
                </div>`;
            });
        });
    });
}

// --- 4. AÇÕES (SALVAR, BLOQUEAR, EXCLUIR) ---
document.getElementById('form-cadastro').addEventListener('submit', (e) => {
    e.preventDefault();
    const novoProd = {
        nome: document.getElementById('nome-brinquedo').value,
        imagem: document.getElementById('imagem-brinquedo').value,
        descricao: document.getElementById('descricao-brinquedo').value,
        valor: document.getElementById('valor-brinquedo').value,
        whatsapp: document.getElementById('whatsapp-dono').value
    };
    database.ref('produtos').push(novoProd).then(() => {
        fecharModal();
        document.getElementById('form-cadastro').reset();
    });
});

function bloquearPeriodo(id) {
    const dataIni = document.getElementById('data-ini-' + id).value;
    const dataFim = document.getElementById('data-fim-' + id).value;

    if (!dataIni || !dataFim) {
        return alert("Por favor, selecione as datas de início e fim!");
    }

    if (new Date(dataIni) > new Date(dataFim)) {
        return alert("A data de início não pode ser maior que a data de fim!");
    }

    const reserva = {
        produto_id: id,
        data_inicio: dataIni,
        data_fim: dataFim,
        timestamp: Date.now()
    };

    database.ref('agendamentos').push(reserva).then(() => {
        alert("Período bloqueado com sucesso!");
        document.getElementById('data-ini-' + id).value = "";
        document.getElementById('data-fim-' + id).value = "";
    });
}

function liberarEFinalizar(idReserva, idSolicitacao) {
    if (!confirm("Deseja finalizar esta locação? O período será liberado e o registro irá para o histórico.")) return;

    // 1. Remove apenas o bloqueio da Agenda (para liberar a data)
    database.ref('agendamentos/' + idReserva).remove().then(() => {
        
        // 2. Muda o status da solicitação para 'finalizada' (o cliente ainda vê, mas como concluída)
        if (idSolicitacao) {
            database.ref('solicitacoes/' + idSolicitacao).update({ 
                status: "finalizada",
                data_finalizacao: Date.now() 
            });
        }
        
        alert("Locação finalizada com sucesso!");
    });
}

function excluirItem(caminho) {
    if(confirm("Deseja realmente excluir este Item?")) {
        database.ref(caminho).remove();
    }
}


window.onload = () => { carregarProdutos(); carregarAgenda(); };

function carregarSolicitacoes() {
    const container = document.getElementById('lista-solicitacoes-pendentes');
    const badge = document.getElementById('badge-notificacao');

    // Escuta em tempo real as solicitações no Firebase
    database.ref('solicitacoes').on('value', snapshot => {
        container.innerHTML = "";
        const solicitacoes = snapshot.val();
        let pendentesContador = 0;

        if (!solicitacoes) {
            container.innerHTML = "<p style='grid-column: 1/-1; text-align:center; padding: 50px; color: #999;'>Nenhuma solicitação pendente no momento.</p>";
            badge.style.display = "none";
            return;
        }

        // Transformamos em array para garantir a ordem (mais recentes primeiro)
        const listaIds = Object.keys(solicitacoes).reverse();

        listaIds.forEach(id => {
            const s = solicitacoes[id];
            
            if (s.status === "pendente") {
                pendentesContador++;
                
                // Buscamos a foto do produto para o card
                database.ref('produtos/' + s.produto_id).once('value', prodSnap => {
                    const p = prodSnap.val();
                    const foto = (p && p.imagem) ? p.imagem.split(',')[0] : 'https://via.placeholder.com/300x180?text=Brinquedo';

                    // Estrutura idêntica ao card de produtos
                    const cardHTML = `
                        <div class="card-padrao">
                            <img src="${foto}" class="img-card" alt="${s.nome_produto}">
                            
                            <div class="conteudo-card">
                                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 5px;">
                                    <small style="color: var(--warning-yellow); font-weight: bold; text-transform: uppercase; font-size: 0.7em;">Aguardando Aprovação</small>
                                    <small style="color: var(--warning-yellow); font-size: 0.75em;">${new Date(s.timestamp).toLocaleDateString()}</small>
                                </div>
                                
                                <h3>${s.nome_produto}</h3>
                                
                                <div class="detalhes-info">
                                    <p><i class="fas fa-user"></i> <strong>${s.cliente_nome}</strong></p>
                                    <p><i class="fas fa-calendar-alt"></i> ${s.data_inicio.split('-').reverse().join('/')} até ${s.data_fim.split('-').reverse().join('/')}</p>
                                    <p><i class="fas fa-map-marker-alt"></i> ${s.cliente_endereco}</p>
                                    <p><i class="fab fa-whatsapp"></i> ${s.cliente_fone}</p>
                                </div>

                                <div class="acoes-card">
                                    <button class="btn-confirmar" onclick="aprovarSolicitacao('${id}')">
                                        <i class="fas fa-check"></i> Aprovar
                                    </button>
                                    <button class="btn-recusar" onclick="recusarSolicitacao('${id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', cardHTML);
                });
            }
        });

        // Atualiza a bolinha de notificação no menu
        if (pendentesContador > 0) {
            badge.innerText = pendentesContador;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    });
}

// A FUNÇÃO MÁGICA: Confirma, move para agenda e bloqueia o calendário
function aprovarSolicitacao(idSolicitacao) {
    if (!confirm("Deseja confirmar esta reserva?")) return;

    database.ref('solicitacoes/' + idSolicitacao).once('value', snapshot => {
        const dados = snapshot.val();

        const novoAgendamento = {
            produto_id: dados.produto_id,
            nome_produto: dados.nome_produto,
            data_inicio: dados.data_inicio,
            data_fim: dados.data_fim,
            cliente: dados.cliente_nome,
            telefone: dados.cliente_fone,
            endereco: dados.cliente_endereco,
            solicitacao_id: idSolicitacao // Salvamos o ID original aqui
        };

        database.ref('agendamentos').push(novoAgendamento).then(() => {
            // Apenas marcamos como confirmado para o cliente ver no momento
            database.ref('solicitacoes/' + idSolicitacao).update({ status: "confirmado" });
            alert("Reserva confirmada!");
        });
    });
}

function recusarSolicitacao(id) {
    if (confirm("Tem certeza que deseja remover esta solicitação?")) {
        database.ref('solicitacoes/' + id).remove();
    }
}

function carregarHistorico() {
    const grid = document.getElementById('grid-historico');
    // Filtramos apenas solicitações com status 'finalizada'
    database.ref('solicitacoes').orderByChild('status').equalTo('finalizada').on('value', snapshot => {
        grid.innerHTML = "";
        const dados = snapshot.val();
        if (!dados) return grid.innerHTML = "<p class='aviso'>Nenhum histórico encontrado.</p>";

        Object.keys(dados).reverse().forEach(id => {
            const h = dados[id];
            grid.innerHTML += `
            <div class="card-padrao" style="opacity: 0.8; border-top: 5px solid #666;">
                <div class="conteudo-card">
                    <small>Finalizado em: ${new Date(h.data_finalizacao).toLocaleDateString()}</small>
                    <h3>${h.nome_produto}</h3>
                    <div class="detalhes-info">
                        <p><i class="fas fa-user"></i> ${h.cliente_nome}</p>
                        <p><i class="fas fa-calendar-check"></i> ${h.data_inicio.split('-').reverse().join('/')} - ${h.data_fim.split('-').reverse().join('/')}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${h.cliente_endereco}</p>
                    </div>
                </div>
            </div>`;
        });
    });
}