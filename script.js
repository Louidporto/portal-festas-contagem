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
// 1. Modifique sua função carregarCardapio para usar .once
async function carregarCardapio() {
    const lista = document.getElementById('lista-brinquedos');
    const filtro = document.getElementById('filtro-categoria').value;
    
    if (!lista) return;

    // Mudamos para .once('value') para que o gatilho externo controle a atualização
    const snapshot = await database.ref('produtos').once('value');
    const produtos = snapshot.val();
    
    if (!produtos) {
        lista.innerHTML = "<p>Nenhum produto cadastrado.</p>";
        return;
    }

    const dataHoje = new Date().toISOString().split('T')[0];
    const IDs = Object.keys(produtos);

    const promessas = IDs.map(id => verificarEstoqueDisponivel(id, dataHoje, dataHoje));
    const estoquesDisponiveis = await Promise.all(promessas);

    lista.innerHTML = ""; 

    IDs.forEach((id, index) => {
        const p = produtos[id];
        
        if (p.status !== "ativo") return;
        if (filtro !== "todos" && p.categoria !== filtro) return;

        const disponivelAgora = estoquesDisponiveis[index];
        const foto = p.imagem ? p.imagem.split(',')[0] : 'https://via.placeholder.com/300x200';
        
        lista.innerHTML += `
            <div class="card-item-cardapio" onclick="abrirAgenda('${id}')">
                <img src="${foto}" class="img-cardapio">
                <div class="info-cardapio">
                    <span class="tag-categoria-cliente">${p.categoria || 'Geral'}</span>
                    <h3>${p.nome}</h3>
                    <div class="estoque-badge">
                        <i class="fas fa-boxes"></i> Disponível hoje: 
                        <strong style="color: ${disponivelAgora > 0 ? '#27ae60' : '#e74c3c'}">
                            ${disponivelAgora}
                        </strong>
                    </div>
                    <span class="preco-btn">Ver Disponibilidade</span>
                </div>
            </div>`;
    });
}

// 2. ADICIONE ISSO LOGO ABAIXO DA FUNÇÃO (FORA DELA)
// Este é o "Gatilho Mestre": ele vigia os agendamentos e recarrega a vitrine se algo mudar
database.ref('agendamentos').on('value', () => {
    console.log("Sistema: Atualizando vitrine devido a mudança nos agendamentos...");
    carregarCardapio();
});

/**
 * 4. CONTROLE DO MODAL E CALENDÁRIO
 */
async function abrirAgenda(idProduto) { // Adicionado 'async' aqui
    // 1. Busca os dados primeiro
    database.ref('produtos/' + idProduto).once('value', async snap => { // Adicionado 'async' no callback
        const dados = snap.val();
        if (!dados) return;

        produtoSelecionado = { id: idProduto, ...dados };
        document.getElementById('nome-produto-modal').innerText = produtoSelecionado.nome;

        // 2. MOSTRA O MODAL PRIMEIRO
        const modal = document.getElementById('modal-calendario');
        modal.style.setProperty('display', 'block', 'important');

        // Define a data de hoje para a consulta inicial
        const dataDeHoje = new Date().toISOString().split('T')[0];

        // Agora o await vai funcionar porque a função é async
        const estoqueRestante = await verificarEstoqueDisponivel(idProduto, dataDeHoje, dataDeHoje);
        
        const infoEstoque = document.getElementById('info-estoque-modal');
        if(infoEstoque) {
            infoEstoque.innerHTML = `Disponibilidade atual: <strong style="color: ${estoqueRestante > 0 ? 'green' : 'red'}">${estoqueRestante} unidade(s)</strong>`;
        }

        // 3. AGUARDA O NAVEGADOR RENDERIZAR O MODAL
        setTimeout(() => {
            renderizarCalendario(idProduto);
        }, 150);
    });
}

function renderizarCalendario(idProduto) {
    const calendarEl = document.getElementById('calendario-view');
    
    // Limpa o conteúdo anterior para não duplicar no mobile
    calendarEl.innerHTML = "";

    database.ref('agendamentos').once('value', snapshot => {
        const agendamentos = snapshot.val() || {};
        const eventosOcupados = [];

        Object.values(agendamentos).forEach(res => {
            if (res.produto_id === idProduto) {
                eventosOcupados.push({
                    start: res.data_inicio,
                    end: ajustarDataFimFullCalendar(res.data_fim),
                    display: 'background',
                    color: '#ff4d4d' // Vermelho para ocupado
                });
            }
        });

        // Destrói instância antiga se existir
        if (calendarioInstancia) {
            calendarioInstancia.destroy();
        }

            calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'pt-br',
                selectable: true,
                longPressDelay: 0,
                
                // --- AJUSTES DE TAMANHO ---
                aspectRatio: 1.35,      /* Aumentar esse número achata o calendário */
                contentHeight: 'auto',  /* Faz o calendário se ajustar ao tamanho das células */
                // --------------------------
            
                headerToolbar: { 
                    left: 'prev,next', 
                    center: 'title', 
                    right: '' 
                },
                events: eventosOcupados,
            select: function(info) {
                document.getElementById('reserva-ini').value = info.startStr;
                let dFim = new Date(info.end);
                dFim.setDate(dFim.getDate() - 1);
                document.getElementById('reserva-fim').value = dFim.toISOString().split('T')[0];
            }
        });

        calendarioInstancia.render();
        
        // Comando mestre para consertar o layout no mobile
        setTimeout(() => {
            calendarioInstancia.updateSize();
        }, 100);
    });
}

/**
 * 5. SOLICITAÇÃO (FIREBASE + WHATSAPP)
 */
async function solicitarReserva() {
    const ini = document.getElementById('reserva-ini').value;
    const fim = document.getElementById('reserva-fim').value;
    const nome = document.getElementById('cliente-nome').value;
    const fone = document.getElementById('cliente-fone').value.replace(/\D/g, "");
    const endereco = document.getElementById('cliente-endereco').value;

    if(!ini || !fim) return alert("Selecione as datas no calendário!");
    if(!nome || !fone || !endereco) return alert("Por favor, preencha todos os campos.");

    // Verifica estoque antes de prosseguir
    const disponivel = await verificarEstoqueDisponivel(produtoSelecionado.id, ini, fim);

    if (disponivel <= 0) {
        alert("Desculpe! Este brinquedo já está totalmente reservado para este período.");
        return;
    }

    const dadosReserva = {
        produto_id: produtoSelecionado.id,
        nome_produto: produtoSelecionado.nome,
        valor_produto: produtoSelecionado.valor,
        data_inicio: ini,
        data_fim: fim,
        cliente_nome: nome,
        cliente_fone: fone,
        cliente_endereco: endereco,
        status: "pendente",
        timestamp: Date.now(),
        estoque_na_reserva: disponivel
    };

    database.ref('solicitacoes').push(dadosReserva).then(() => {
        const msg = `Olá! Acabei de fazer uma *solicitação de reserva* pelo portal:%0A%0A` +
                    `*Produto:* ${produtoSelecionado.nome}%0A` +
                    `*Período:* ${ini.split('-').reverse().join('/')} até ${fim.split('-').reverse().join('/')}%0A` +
                    `*Cliente:* ${nome}%0A` +
                    `*Endereço:* ${endereco}`;

        const foneFornecedor = (produtoSelecionado.whatsapp_dono || "5531999999999").replace(/\D/g, "");
        const linkWhats = `https://wa.me/${foneFornecedor}?text=${msg}`;

        window.open(linkWhats, '_blank');
        alert("Solicitação enviada com sucesso!");
        
        fecharModalCalendario();
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
 * 7. CONSULTAR PEDIDOS (Atualizado para incluir status Agendado)
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
            let statusClass = '';
            let statusTexto = '';
            let larguraProgresso = '0%';

            // --- LÓGICA DE STATUS ATUALIZADA ---
            switch (p.status) {
                case 'pendente':
                    statusClass = 'status-pendente';
                    statusTexto = 'Aguardando Fornecedor';
                    larguraProgresso = '33%';
                    break;
                case 'agendado': // Novo caso para o status "agendado"
                case 'confirmado':
                    statusClass = 'status-confirmado'; // Usa o verde do confirmado
                    statusTexto = 'Reserva Agendada';
                    larguraProgresso = '75%'; // Barra bem mais cheia
                    break;
                case 'finalizada':
                    statusClass = 'status-finalizada';
                    statusTexto = 'Locação Concluída';
                    larguraProgresso = '100%';
                    break;
                default:
                    statusClass = 'status-pendente';
                    statusTexto = p.status;
                    larguraProgresso = '10%';
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
                        <div class="progresso-preenchido" style="width: ${larguraProgresso}; background-color: ${(p.status === 'finalizada' || p.status === 'agendado') ? 'var(--success-green)' : ''}"></div>
                    </div>
                    
                    ${p.status === 'finalizada' ? '<p style="font-size: 0.75rem; color: var(--success-green); margin-top: 8px; text-align: center; font-weight: bold;">✓ Equipamento devolvido e locação finalizada</p>' : ''}
                </div>
            `;
        });
    });
}
// Adicione isso ao seu arquivo JS para garantir que o clique funcione no mobile
document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('click', function() {
        if (typeof this.showPicker === 'function') {
            this.showPicker(); // Força a abertura do seletor nativo do celular
        }
    });
});

/**
 * 8. CONSULTAR ESTOQUE(Atualizado com status Finalizada)
 */
async function verificarEstoqueDisponivel(idProduto, dataInicio, dataFim) {
    const snapProd = await database.ref('produtos/' + idProduto).once('value');
    const produto = snapProd.val();
    const estoqueTotal = parseInt(produto.estoque_total) || 1;

    const snapAgend = await database.ref('agendamentos').once('value');
    const agendamentos = snapAgend.val() || {};

    let ocupados = 0;

    Object.values(agendamentos).forEach(res => {
        // --- A MUDANÇA ESTÁ AQUI ---
        // Só contamos como 'ocupado' se o produto for o mesmo E o status NÃO for finalizado
        if (res.produto_id === idProduto && res.status !== 'finalizada') {
            
            // Verifica se as datas coincidem
            if (dataInicio <= res.data_fim && dataFim >= res.data_inicio) {
                ocupados++;
            }
        }
    });

    return estoqueTotal - ocupados;
}
