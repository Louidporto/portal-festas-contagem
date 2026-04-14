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
 * GATILHOS PARA CÁLCULO DE ESTOQUE EM TEMPO REAL
 */
document.addEventListener('change', function(e) {
    if (e.target && (e.target.id === 'reserva-ini' || e.target.id === 'reserva-fim')) {
        const idProd = produtoSelecionado ? produtoSelecionado.id : null;
        const dataIni = document.getElementById('reserva-ini').value;
        const dataFim = document.getElementById('reserva-fim').value;

        if (idProd && dataIni && dataFim) {
            if (dataIni > dataFim) {
                alert("A data de início não pode ser maior que a data de fim.");
                return;
            }
            // Chama a função de cálculo que você já tem
            calcularEstoqueDisponivel(idProd, dataIni, dataFim);
        }
    }
});

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
                    <p style="font-size: 0.8rem; color: #777; margin-bottom: 8px;">${p.descricao || ''}</p>
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
async function abrirAgenda(idProduto) {
    // 1. Resetar a interface do estoque antes de carregar o novo produto
    const containerEstoque = document.getElementById('container-estoque-periodo');
    const selectQtd = document.getElementById('select-quantidade-reserva');
    if (containerEstoque) containerEstoque.style.display = 'none';
    if (selectQtd) selectQtd.innerHTML = "<option>Selecione as datas...</option>";

    // 2. Busca os dados do produto
    database.ref('produtos/' + idProduto).once('value', async snap => {
        const dados = snap.val();
        if (!dados) return;

        produtoSelecionado = { id: idProduto, ...dados };
        document.getElementById('nome-produto-modal').innerText = produtoSelecionado.nome;

        // 3. Mostra o modal
        const modal = document.getElementById('modal-calendario');
        modal.style.setProperty('display', 'block', 'important');

        // Define a data de hoje para a consulta inicial rápida
        const dataDeHoje = new Date().toISOString().split('T')[0];
        const estoqueRestante = await verificarEstoqueDisponivel(idProduto, dataDeHoje, dataDeHoje);
        
        const infoEstoque = document.getElementById('info-estoque-modal');
        if(infoEstoque) {
            infoEstoque.innerHTML = `Disponibilidade geral: <strong style="color: ${estoqueRestante > 0 ? 'green' : 'red'}">${estoqueRestante} unidade(s)</strong>`;
        }

        // 4. Aguarda renderização para o FullCalendar
        setTimeout(() => {
            renderizarCalendario(idProduto);
        }, 150);
    });
}

let dataPrimeiroClique = null; // Variável para controlar os cliques

function renderizarCalendario(idProduto) {
    const calendarEl = document.getElementById('calendario-view');
    calendarEl.innerHTML = "";
    dataPrimeiroClique = null; // Reseta sempre que abrir o calendário

    database.ref('agendamentos').once('value', snapshot => {
        const agendamentos = snapshot.val() || {};
        const eventosOcupados = [];

        Object.values(agendamentos).forEach(res => {
            if (res.produto_id === idProduto && res.status !== 'finalizada') {
                eventosOcupados.push({
                    start: res.data_inicio,
                    end: ajustarDataFimFullCalendar(res.data_fim),
                    display: 'background',
                    color: '#ff4d4d'
                });
            }
        });

        if (calendarioInstancia) { calendarioInstancia.destroy(); }

        calendarioInstancia = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'pt-br',
            selectable: true,
            unselectAuto: false, // Impede que a seleção suma ao clicar fora
            headerToolbar: { left: 'prev,next', center: 'title', right: '' },
            events: eventosOcupados,
            aspectRatio: 1.35,
            contentHeight: 'auto',

            // LÓGICA DE DOIS CLIQUES
            dateClick: function(info) {
                const inputIni = document.getElementById('reserva-ini');
                const inputFim = document.getElementById('reserva-fim');

                if (!dataPrimeiroClique) {
                    // PRIMEIRO CLIQUE: Define o início
                    dataPrimeiroClique = info.dateStr;
                    inputIni.value = info.dateStr;
                    inputFim.value = ""; // Limpa o fim enquanto espera o segundo clique
                    
                    // Visual: Seleciona visualmente apenas o primeiro dia
                    calendarioInstancia.select(info.dateStr);
                } else {
                    // SEGUNDO CLIQUE: Define o fim
                    let dataSegunda = info.dateStr;

                    // Validação: Se clicar em uma data anterior à primeira, inverte as datas
                    let d1 = dataPrimeiroClique;
                    let d2 = dataSegunda;
                    if (d2 < d1) { [d1, d2] = [d2, d1]; }

                    inputIni.value = d1;
                    inputFim.value = d2;

                    // Aplica a seleção visual no calendário
                    // No FullCalendar, o select(start, end) é exclusivo no fim, então somamos 1 dia para colorir a célula do dia final
                    let dFimVisual = new Date(d2);
                    dFimVisual.setDate(dFimVisual.getDate() + 1);
                    calendarioInstancia.select(d1, dFimVisual.toISOString().split('T')[0]);

                    // Dispara o cálculo de estoque
                    calcularEstoqueDisponivel(idProduto, d1, d2);

                    // Reseta para permitir uma nova seleção de dois cliques se ele mudar de ideia
                    dataPrimeiroClique = null;
                }
            },

            // Mantemos o 'select' para caso ele ainda prefira arrastar (funciona dos dois jeitos agora)
            select: function(info) {
                const inputIni = document.getElementById('reserva-ini');
                const inputFim = document.getElementById('reserva-fim');

                inputIni.value = info.startStr;
                let dFim = new Date(info.end);
                dFim.setDate(dFim.getDate() - 1);
                const dataFimFormatada = dFim.toISOString().split('T')[0];
                inputFim.value = dataFimFormatada;

                calcularEstoqueDisponivel(idProduto, info.startStr, dataFimFormatada);
                dataPrimeiroClique = null; // Reseta se ele arrastar
            }
        });

        calendarioInstancia.render();
        setTimeout(() => { calendarioInstancia.updateSize(); }, 100);
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
    
    const selectQtd = document.getElementById('select-quantidade-reserva');
    const quantidadeDesejada = parseInt(selectQtd.value) || 0;

    if(!ini || !fim) return alert("Selecione as datas no calendário!");
    if(!nome || !fone || !endereco) return alert("Por favor, preencha todos os campos.");
    if(quantidadeDesejada <= 0) return alert("Não há estoque disponível para este período.");

    // --- A MUDANÇA COMEÇA AQUI ---
    
    // 1. Pegamos o contato do dono que veio do banco de dados (cadastrado no ADM)
    // Se não existir no produto, usamos um número padrão como reserva (fallback)
    const contatoDonoRaw = produtoSelecionado.whatsapp_dono || produtoSelecionado.contato || "5531999999999";
    const foneFornecedor = contatoDonoRaw.replace(/\D/g, ""); // Limpa parênteses e espaços

    const dadosReserva = {
        produto_id: produtoSelecionado.id,
        nome_produto: produtoSelecionado.nome,
        valor_produto: produtoSelecionado.valor,
        data_inicio: ini,
        data_fim: fim,
        cliente_nome: nome,
        cliente_fone: fone,
        cliente_endereco: endereco,
        quantidade_alugada: quantidadeDesejada,
        status: "pendente",
        timestamp: Date.now()
    };

    database.ref('solicitacoes').push(dadosReserva).then(() => {
        const msg = `Olá! Fiz uma *solicitação de reserva* pelo portal:%0A%0A` +
                    `*Produto:* ${produtoSelecionado.nome}%0A` +
                    `*Quantidade:* ${quantidadeDesejada} unidade(s)%0A` +
                    `*Período:* ${ini.split('-').reverse().join('/')} até ${fim.split('-').reverse().join('/')}%0A` +
                    `*Cliente:* ${nome}%0A` +
                    `*Endereço:* ${endereco}`;

        // 2. Agora usamos a variável dinâmica foneFornecedor
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

//  A Lógica de Cálculo (JavaScript)
async function calcularEstoqueDisponivel(idProduto, dataInicio, dataFim) {
    if (!dataInicio || !dataFim) return;

    // 1. Busca o estoque total do produto
    const prodSnap = await database.ref('produtos/' + idProduto).once('value');
    const produto = prodSnap.val();
    const estoqueTotal = parseInt(produto.estoque_total) || 1;

    // 2. Busca todos os agendamentos ativos para este produto
    const agendSnap = await database.ref('agendamentos')
        .orderByChild('produto_id')
        .equalTo(idProduto)
        .once('value');
    
    const agendamentos = agendSnap.val() || {};
    let ocupadosNoPeriodo = 0;

    // 3. Verifica sobreposição de datas
    // Lógica: O item está ocupado se (InicioPedida <= FimExistente) E (FimPedido >= InicioExistente)
    Object.values(agendamentos).forEach(res => {
        if (res.status !== 'finalizada') {
            const resInicio = res.data_inicio;
            const resFim = res.data_fim;

            if (dataInicio <= resFim && dataFim >= resInicio) {
                // Se você salva a quantidade alugada em cada reserva, some res.quantidade
                // Se for sempre 1 por reserva, some 1
                ocupadosNoPeriodo += (parseInt(res.quantidade_alugada) || 1);
            }
        }
    });

    const disponivel = estoqueTotal - ocupadosNoPeriodo;
    const campoDisponivel = document.getElementById('qtd-disponivel-periodo');
    const selectQtd = document.getElementById('select-quantidade-reserva');
    const container = document.getElementById('container-estoque-periodo');

    container.style.display = "block";
    campoDisponivel.innerText = disponivel > 0 ? disponivel : 0;

    // 4. Preenche o Select com as opções disponíveis
    selectQtd.innerHTML = "";
    if (disponivel <= 0) {
        selectQtd.innerHTML = "<option value='0'>Indisponível para estas datas</option>";
        selectQtd.disabled = true;
    } else {
        selectQtd.disabled = false;
        for (let i = 1; i <= disponivel; i++) {
            selectQtd.innerHTML += `<option value="${i}">${i} unidade(s)</option>`;
        }
    }
}
