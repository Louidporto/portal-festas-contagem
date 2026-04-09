// --- VARIÁVEIS GLOBAIS ---
let produtoSelecionado = null;
let calendarioInstancia = null;

/**
 * 1. INICIALIZAÇÃO
 */
window.onload = function() {
    console.log("Portal iniciado...");
    carregarCardapio();
};

/**
 * 2. NAVEGAÇÃO DO PORTAL (Alternar Abas)
 */
function alternarSecao(secaoAlvo) {
    const secaoCatalogo = document.getElementById('secao-catalogo');
    const secaoSolicitacoes = document.getElementById('secao-solicitacoes');
    const btnCat = document.getElementById('btn-catalogo');
    const btnSol = document.getElementById('btn-solicitacoes');

    if (secaoAlvo === 'catalogo') {
        secaoCatalogo.style.display = 'block';
        secaoSolicitacoes.style.display = 'none';
        btnCat.classList.add('active');
        btnSol.classList.remove('active');
    } else {
        secaoCatalogo.style.display = 'none';
        secaoSolicitacoes.style.display = 'block';
        btnCat.classList.remove('active');
        btnSol.classList.add('active');
    }
}

/**
 * 3. CARREGAR CATÁLOGO (VITRINE)
 */
function carregarCardapio() {
    const lista = document.getElementById('lista-brinquedos');
    if (!lista) return;

    database.ref('produtos').on('value', snapshot => {
        lista.innerHTML = "";
        const produtos = snapshot.val();
        if (!produtos) return;

        Object.keys(produtos).forEach(id => {
            const p = produtos[id];
            const foto = p.imagem ? p.imagem.split(',')[0] : 'https://via.placeholder.com/300x200';
            
            lista.innerHTML += `
                <div class="card-item-cardapio" onclick="abrirAgenda('${id}')">
                    <img src="${foto}" class="img-cardapio">
                    <div class="info-cardapio">
                        <h3>${p.nome}</h3>
                        <p>${p.descricao || ""}</p>
                        <span class="preco-btn">Ver Disponibilidade </span>
                    </div>
                </div>`;
        });
    });
}

/**
 * 4. CONTROLE DO MODAL E CALENDÁRIO
 */
function abrirAgenda(idProduto) {
    database.ref('produtos/' + idProduto).once('value', snap => {
        const dados = snap.val();
        if (!dados) return;

        produtoSelecionado = { id: idProduto, ...dados };
        
        document.getElementById('nome-produto-modal').innerText = produtoSelecionado.nome;
        document.getElementById('reserva-ini').value = "";
        document.getElementById('reserva-fim').value = "";
        document.getElementById('calendario-view').innerHTML = "";

        document.getElementById('modal-calendario').style.display = 'block';

        setTimeout(() => {
            renderizarCalendario(idProduto);
        }, 300);
    });
}

function renderizarCalendario(idProduto) {
    const calendarEl = document.getElementById('calendario-view');
    
    database.ref('agendamentos').once('value', snapshot => {
        const agendamentos = snapshot.val() || {};
        const eventosOcupados = [];

        Object.values(agendamentos).forEach(res => {
            if (res.produto_id === idProduto) {
                eventosOcupados.push({
                    start: res.data_inicio,
                    end: ajustarDataFimFullCalendar(res.data_fim),
                    display: 'background',
                    color: '#7f8c8d' // Cinza para ocupados
                });
            }
        });

        if (calendarioInstancia) {
            calendarioInstancia.destroy();
            calendarioInstancia = null;
        }

        calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt-br',
            selectable: true,
            headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
            events: eventosOcupados,
            dayCellDidMount: function(info) {
                // Fundo verde para livre (conforme configuramos no CSS)
                info.el.style.backgroundColor = "#d4edda"; 
            },
            select: function(info) {
                document.getElementById('reserva-ini').value = info.startStr;
                let dFim = new Date(info.end);
                dFim.setDate(dFim.getDate() - 1);
                document.getElementById('reserva-fim').value = dFim.toISOString().split('T')[0];
            }
        });

        calendarioInstancia.render();
    });
}

/**
 * 5. SOLICITAÇÃO (FIREBASE + WHATSAPP)
 */
function solicitarReserva() {
    const ini = document.getElementById('reserva-ini').value;
    const fim = document.getElementById('reserva-fim').value;
    const nome = document.getElementById('cliente-nome').value;
    const fone = document.getElementById('cliente-fone').value.replace(/\D/g, ""); // Remove letras/espaços
    const endereco = document.getElementById('cliente-endereco').value;

    // Validação simples
    if(!ini || !fim) return alert("Selecione as datas no calendário!");
    if(!nome || !fone || !endereco) return alert("Por favor, preencha todos os campos para contato.");

    const dadosReserva = {
        produto_id: produtoSelecionado.id,
        nome_produto: produtoSelecionado.nome,
        valor_produto: produtoSelecionado.valor,
        data_inicio: ini,
        data_fim: fim,
        cliente_nome: nome,
        cliente_fone: fone, // Usaremos isso para a consulta do cliente
        cliente_endereco: endereco,
        status: "pendente",
        timestamp: Date.now()
    };

    // Salva no Firebase
    database.ref('solicitacoes').push(dadosReserva).then(() => {
        alert("Solicitação enviada com sucesso! Você pode acompanhar o status na aba 'Minhas Solicitações'.");
        
        // Limpa os campos
        document.getElementById('cliente-nome').value = "";
        document.getElementById('cliente-fone').value = "";
        document.getElementById('cliente-endereco').value = "";
        
        fecharModalCalendario();
        
        // Opcional: Ainda podemos abrir o Whats se você quiser, mas agora os dados já estão no banco!
    }).catch(error => {
        console.error("Erro ao salvar:", error);
        alert("Erro ao enviar solicitação.");
    });
}

/**
 * 6. FUNÇÕES AUXILIARES
 */
function fecharModalCalendario() {
    document.getElementById('modal-calendario').style.display = 'none';
}

function ajustarDataFimFullCalendar(dataString) {
    if (!dataString) return null;
    let d = new Date(dataString);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById('modal-calendario');
    if (event.target == modal) fecharModalCalendario();
};

/**
 * 7. CONSULTAR PEDIDOS (Atualizado com status Finalizada)
 */
function consultarPedidosCliente() {
    const whatsConsulta = document.getElementById('cliente-whatsapp-consulta').value.replace(/\D/g, "");
    const containerHistorico = document.getElementById('historico-pedidos');

    if (!whatsConsulta) return alert("Digite o número do seu WhatsApp cadastrado.");

    containerHistorico.innerHTML = "<p>Buscando suas solicitações...</p>";

    database.ref('solicitacoes').orderByChild('cliente_fone').equalTo(whatsConsulta).once('value', snapshot => {
        containerHistorico.innerHTML = "";
        const pedidos = snapshot.val();

        if (!pedidos) {
            containerHistorico.innerHTML = "<p class='aviso'>Nenhuma solicitação encontrada para este número.</p>";
            return;
        }

        Object.values(pedidos).reverse().forEach(p => {
            // 1. Definição Dinâmica de Status e Cores
            let statusClass = '';
            let statusTexto = '';
            let larguraProgresso = '0%';

            switch (p.status) {
                case 'pendente':
                    statusClass = 'status-pendente';
                    statusTexto = 'Aguardando Fornecedor';
                    larguraProgresso = '33%';
                    break;
                case 'confirmado':
                    statusClass = 'status-confirmado';
                    statusTexto = 'Reserva Confirmada';
                    larguraProgresso = '66%';
                    break;
                case 'finalizada':
                    statusClass = 'status-finalizada'; // Criar esta classe no CSS do cliente
                    statusTexto = 'Locação Concluída';
                    larguraProgresso = '100%';
                    break;
                default:
                    statusClass = 'status-pendente';
                    statusTexto = p.status;
            }

            containerHistorico.innerHTML += `
                <div class="card-pedido-cliente" style="${p.status === 'finalizada' ? 'opacity: 0.85;' : ''}">
                    <div class="pedido-header">
                        <strong>${p.nome_produto}</strong>
                        <span class="status-badge ${statusClass}">${statusTexto}</span>
                    </div>
                    <div class="pedido-detalhes">
                        <p><i class="far fa-calendar-alt"></i> ${p.data_inicio.split('-').reverse().join('/')} até ${p.data_fim.split('-').reverse().join('/')}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${p.cliente_endereco}</p>
                    </div>
                    
                    <div class="barra-progresso">
                        <div class="progresso-preenchido" style="width: ${larguraProgresso}; background-color: ${p.status === 'finalizada' ? 'var(--success-green)' : ''}"></div>
                    </div>
                    
                    ${p.status === 'finalizada' ? '<p style="font-size: 0.75rem; color: var(--success-green); margin-top: 8px; text-align: center; font-weight: bold;">✓ Equipamento devolvido e locação finalizada</p>' : ''}
                </div>
            `;
        });
    });
}