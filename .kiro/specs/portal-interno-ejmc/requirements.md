# Documento de Requisitos — Portal Interno EJMC

## Introdução

O Portal Interno EJMC é uma plataforma web que centraliza todas as ferramentas de gestão da empresa júnior em um único lugar. O sistema atende até 80 usuários com diferentes níveis de permissão, oferecendo módulos de dashboard, cronograma, metas, KPIs, membros, projetos, comunicados, enquetes, pontuação e reserva de computadores. A plataforma deve ser responsiva (desktop, tablet e mobile).

## Glossário

- **Portal**: A aplicação web Portal Interno EJMC
- **Usuário**: Qualquer pessoa autenticada no Portal
- **Administrador**: Nível de permissão com acesso total ao sistema, incluindo aprovação de contas
- **Diretor**: Nível de permissão com acesso a criação de metas, eventos, comunicados e enquetes
- **Gerente**: Nível de permissão com acesso a criação de eventos, comunicados e enquetes
- **Coordenador**: Nível de permissão com acesso a criação de eventos e comunicados
- **Membro**: Nível de permissão básico com acesso de visualização
- **Área**: Divisão organizacional da empresa (Vendas, Presidência, Projetos, Marketing, Gestão de Pessoas, Adm-Fin)
- **KPI**: Indicador-chave de desempenho (Key Performance Indicator) de uma Área
- **Meta**: Objetivo com prazo e percentual de progresso
- **Projeto**: Trabalho executado pela empresa com nome, detalhes, equipe e status
- **Comunicado**: Publicação no mural de avisos do Portal
- **Enquete**: Votação de múltipla escolha criada por Diretores ou Gerentes
- **Pontuação**: Sistema de registro de infrações (atrasos, faltas, dress code) gerenciado pela equipe de Gestão de Pessoas
- **Reserva**: Agendamento de uso de um computador por um Usuário em um dia específico

## Requisitos

### Requisito 1: Autenticação por Email e Senha

**User Story:** Como um usuário, eu quero fazer login com email e senha, para que eu possa acessar o Portal de forma segura.

#### Critérios de Aceitação

1. WHEN um Usuário submete um email cadastrado e a senha correspondente correta, THE Portal SHALL autenticar o Usuário, criar uma sessão com duração máxima de 8 horas de inatividade, e redirecionar para o Dashboard Geral
2. IF um Usuário submeter um email não cadastrado ou uma senha que não corresponde ao email informado, THEN THE Portal SHALL exibir uma mensagem de erro genérica indicando que as credenciais são inválidas, sem revelar qual campo está incorreto
3. IF a sessão do Usuário atingir 8 horas de inatividade, THEN THE Portal SHALL encerrar a sessão e redirecionar o Usuário para a tela de login
4. IF um Usuário realizar 5 tentativas consecutivas de login com falha para o mesmo email dentro de 15 minutos, THEN THE Portal SHALL bloquear temporariamente novas tentativas de login para esse email por 15 minutos e exibir uma mensagem indicando o bloqueio temporário
5. IF um Usuário submeter credenciais corretas para uma conta que ainda não foi aprovada por um Administrador ou que está desativada, THEN THE Portal SHALL exibir uma mensagem de erro indicando que a conta não está ativa e não conceder acesso

### Requisito 2: Autenticação via Google

**User Story:** Como um usuário, eu quero fazer login com minha conta Google, para que eu possa acessar o Portal de forma rápida e conveniente.

#### Critérios de Aceitação

1. WHEN um Usuário seleciona a opção de login com Google, THE Portal SHALL iniciar o fluxo de autenticação OAuth com o Google
2. WHEN o Google retorna autenticação bem-sucedida para um email já cadastrado e aprovado, THE Portal SHALL autenticar o Usuário e redirecionar para o Dashboard Geral
3. WHEN o Google retorna autenticação bem-sucedida para um email não cadastrado, THE Portal SHALL criar uma solicitação de cadastro pendente de aprovação e exibir uma mensagem informando ao Usuário que o cadastro foi enviado e aguarda aprovação de um Administrador
4. IF o Google retorna autenticação bem-sucedida para um email cadastrado mas ainda não aprovado, THEN THE Portal SHALL exibir uma mensagem informando ao Usuário que seu cadastro ainda está pendente de aprovação
5. IF o fluxo de autenticação com o Google falha ou é cancelado pelo Usuário, THEN THE Portal SHALL retornar o Usuário à tela de login e exibir uma mensagem indicando que a autenticação não foi concluída

### Requisito 3: Auto-Cadastro com Aprovação

**User Story:** Como um novo membro da empresa, eu quero me cadastrar no Portal, para que eu possa solicitar acesso ao sistema.

#### Critérios de Aceitação

1. WHEN um visitante submete o formulário de cadastro com nome completo (entre 3 e 150 caracteres), email corporativo válido e senha (mínimo 8 caracteres contendo ao menos uma letra maiúscula, uma minúscula e um número), THE Portal SHALL criar uma conta com status "pendente de aprovação" e exibir uma mensagem de confirmação informando que a solicitação será analisada por um Administrador
2. IF um visitante submete o formulário de cadastro com um email já associado a uma conta existente, THEN THE Portal SHALL rejeitar o cadastro e exibir uma mensagem de erro indicando que o email já está em uso
3. WHILE uma conta estiver com status "pendente de aprovação", THE Portal SHALL impedir o login do Usuário e exibir uma mensagem indicando que a conta aguarda aprovação
4. WHEN um Administrador aprova uma conta pendente, THE Portal SHALL ativar a conta com o nível de permissão "Membro", e enviar um email de notificação ao Usuário em até 5 minutos informando que o acesso foi concedido
5. WHEN um Administrador rejeita uma conta pendente, THE Portal SHALL alterar o status da conta para "rejeitada", impedir futuras tentativas de login com essas credenciais, e enviar um email de notificação ao Usuário em até 5 minutos informando que a solicitação foi recusada
6. IF um visitante submete o formulário de cadastro com campos obrigatórios em branco ou com formato inválido, THEN THE Portal SHALL impedir a submissão e destacar visualmente os campos com erro, exibindo uma mensagem de validação específica para cada campo inválido

### Requisito 4: Gerenciamento de Contas pelo Administrador

**User Story:** Como um administrador, eu quero gerenciar contas de usuários, para que eu possa controlar quem tem acesso ao Portal.

#### Critérios de Aceitação

1. THE Portal SHALL exibir uma página de administração acessível apenas a Usuários com nível de permissão Administrador
2. WHEN um Administrador acessa a página de administração, THE Portal SHALL listar todas as contas do sistema agrupadas por status (pendentes, ativas e inativas), exibindo nome, email e nível de permissão de cada conta
3. WHEN um Administrador cria uma nova conta informando nome, email e nível de permissão, THE Portal SHALL registrar o Usuário com o nível de permissão especificado e status ativo
4. IF um Administrador tenta criar uma conta com um email já cadastrado, THEN THE Portal SHALL rejeitar a operação e exibir uma mensagem de erro indicando que o email já está em uso
5. WHEN um Administrador aprova uma conta pendente, THE Portal SHALL alterar o status da conta para ativa e permitir o acesso do Usuário ao sistema
6. WHEN um Administrador exclui uma conta, THE Portal SHALL desativar a conta e revogar o acesso do Usuário, encerrando quaisquer sessões ativas desse Usuário
7. IF um Administrador tenta desativar ou rebaixar a única conta com nível Administrador no sistema, THEN THE Portal SHALL rejeitar a operação e exibir uma mensagem de erro indicando que o sistema requer ao menos um Administrador ativo
8. WHEN um Administrador altera o nível de permissão de um Usuário, THE Portal SHALL aplicar as novas permissões a partir da próxima requisição do Usuário ao sistema

### Requisito 5: Controle de Permissões

**User Story:** Como um administrador, eu quero que o sistema controle o acesso por nível de permissão, para que cada membro veja apenas o que é pertinente ao seu papel.

#### Critérios de Aceitação

1. THE Portal SHALL restringir o acesso a funcionalidades e telas conforme a seguinte matriz de permissões: Administrador (acesso total, incluindo página de administração), Diretor (criar metas, eventos, comunicados, enquetes e visualizar módulo de Pontuação), Gerente (criar eventos, comunicados, enquetes e visualizar módulo de Pontuação se pertencer à equipe de Gestão de Pessoas), Coordenador (criar eventos, comunicados), Membro (somente visualização), sendo o módulo Reserva de Computadores acessível a todos os níveis
2. IF um Usuário tenta acessar uma funcionalidade para a qual não possui permissão (via navegação direta por URL ou qualquer outro meio), THEN THE Portal SHALL bloquear o acesso e exibir uma mensagem informando que o acesso é restrito, sem revelar detalhes sobre a funcionalidade protegida
3. THE Portal SHALL ocultar do menu de navegação os itens para os quais o Usuário não possui permissão de acordo com a matriz definida no critério 1
4. WHEN o nível de permissão de um Usuário é alterado por um Administrador, THE Portal SHALL aplicar as novas permissões na próxima ação do Usuário afetado, sem necessidade de logout

### Requisito 6: Menu de Navegação

**User Story:** Como um usuário, eu quero um menu de navegação, para que eu possa acessar todos os módulos disponíveis de forma rápida.

#### Critérios de Aceitação

1. THE Portal SHALL exibir um menu de navegação persistente em todas as páginas, contendo links para todos os módulos acessíveis ao Usuário conforme seu nível de permissão
2. WHILE o Portal é exibido em dispositivo desktop (largura acima de 1024px) ou tablet (largura entre 768px e 1024px), THE Portal SHALL exibir o menu de navegação de forma expandida e visível sem interação adicional
3. WHILE o Portal é exibido em dispositivo mobile (largura abaixo de 768px), THE Portal SHALL exibir o menu de navegação em formato recolhido, acessível por meio de um botão de alternância (toggle)
4. WHEN o Usuário pressiona o botão de alternância do menu em dispositivo mobile, THE Portal SHALL expandir ou recolher o menu de navegação
5. WHEN o Usuário navega para um módulo, THE Portal SHALL indicar visualmente o item ativo no menu de forma distinguível dos itens inativos

### Requisito 7: Dashboard Geral

**User Story:** Como um usuário, eu quero visualizar um painel geral, para que eu possa ter uma visão rápida dos indicadores da empresa.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir a quantidade de membros com status ativo no sistema
2. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir a quantidade de projetos com status "em andamento"
3. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir a quantidade de projetos com status "congelado"
4. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir o faturamento acumulado do mês corrente em reais (R$)
5. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir a meta de faturamento definida para o mês corrente em reais (R$)
6. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir a quantidade de leads gerados no mês corrente
7. WHEN um Usuário acessa o Dashboard Geral, THE Portal SHALL exibir as atividades programadas para o mês corrente, ordenadas por data em ordem cronológica, limitadas a no máximo 10 itens
8. IF os dados de algum indicador não estiverem disponíveis ao carregar o Dashboard Geral, THEN THE Portal SHALL exibir o valor zero para indicadores numéricos e uma lista vazia para atividades

### Requisito 8: Cronograma com Integração Google Calendar

**User Story:** Como um membro, eu quero visualizar o cronograma da empresa, para que eu possa acompanhar eventos e compromissos.

#### Critérios de Aceitação

1. THE Portal SHALL integrar com o Google Calendar para exibir eventos da empresa, atualizando os dados exibidos em no máximo 60 segundos após qualquer alteração no Google Calendar
2. WHEN um Diretor, Gerente ou Coordenador cria um evento no módulo de Cronograma informando no mínimo título (até 100 caracteres), data/hora de início e data/hora de fim, THE Portal SHALL sincronizar o evento com o Google Calendar em no máximo 30 segundos
3. WHEN um Diretor, Gerente ou Coordenador edita um evento existente, THE Portal SHALL atualizar o evento correspondente no Google Calendar em no máximo 30 segundos
4. WHEN um Diretor, Gerente ou Coordenador exclui um evento existente, THE Portal SHALL remover o evento correspondente do Google Calendar em no máximo 30 segundos
5. WHEN um Membro acessa o módulo de Cronograma, THE Portal SHALL exibir os eventos em formato de calendário (somente leitura) com visualização mensal como padrão e possibilidade de navegação entre meses anteriores e posteriores
6. IF um Membro tenta criar, editar ou excluir um evento, THEN THE Portal SHALL bloquear a ação e exibir mensagem informando que apenas Diretores, Gerentes e Coordenadores possuem essa permissão
7. IF a sincronização com o Google Calendar falhar, THEN THE Portal SHALL exibir mensagem de erro indicando a falha na sincronização e preservar os dados do evento localmente para tentativa automática de sincronização posterior (até 3 tentativas com intervalo de 60 segundos)

### Requisito 9: Metas da Empresa e por Área

**User Story:** Como um diretor, eu quero definir metas para a empresa e para cada área, para que possamos acompanhar o progresso dos objetivos.

#### Critérios de Aceitação

1. WHEN um Diretor ou Administrador cria uma Meta, THE Portal SHALL registrar a Meta com nome (máximo 100 caracteres), descrição (máximo 500 caracteres), prazo (data futura) e percentual de progresso inicial (0%)
2. THE Portal SHALL permitir a criação de Metas gerais (empresa) e Metas por Área, onde a Área deve ser uma das áreas cadastradas no sistema (Vendas, Presidência, Projetos, Marketing, Gestão de Pessoas, Adm-Fin)
3. WHEN um Diretor ou Administrador atualiza o progresso de uma Meta, THE Portal SHALL registrar o novo percentual de progresso como um valor inteiro entre 0 e 100
4. WHEN um Usuário acessa o módulo de Metas, THE Portal SHALL exibir as Metas gerais da empresa e as Metas da Área à qual o Usuário pertence, apresentando nome, prazo e percentual de progresso de cada Meta
5. IF o prazo de uma Meta for atingido e o progresso for inferior a 100%, THEN THE Portal SHALL exibir a Meta com um indicador visual distinto identificando-a como vencida
6. IF um Diretor ou Administrador tentar criar ou atualizar uma Meta com dados inválidos (nome vazio, prazo no passado, ou percentual fora do intervalo 0-100), THEN THE Portal SHALL rejeitar a operação e exibir mensagem de erro indicando o campo inválido
7. WHEN um Diretor ou Administrador cria uma Meta por Área, THE Portal SHALL associar a Meta exclusivamente à Área selecionada e torná-la visível apenas para Usuários daquela Área e para Diretores e Administradores

### Requisito 10: KPIs por Área

**User Story:** Como um gestor de área, eu quero registrar KPIs da minha área, para que possamos monitorar o desempenho.

#### Critérios de Aceitação

1. THE Portal SHALL organizar KPIs por Área, agrupando os indicadores sob as seguintes áreas: Vendas, Presidência, Projetos, Marketing, Gestão de Pessoas e Adm-Fin, de modo que cada Usuário autorizado visualize e registre apenas os KPIs da sua própria Área
2. WHEN um Usuário autorizado insere um valor de KPI, THE Portal SHALL registrar o valor numérico (com até 2 casas decimais) juntamente com a data de inserção, associando o registro à Área e ao KPI correspondente
3. IF um Usuário autorizado insere um valor de KPI com formato inválido ou fora do intervalo permitido para aquele indicador, THEN THE Portal SHALL rejeitar a entrada e exibir mensagem de erro indicando o formato ou intervalo esperado, sem descartar os dados já preenchidos no formulário
4. WHEN um Usuário acessa o módulo de KPIs e seleciona uma Área, THE Portal SHALL exibir os indicadores daquela Área com o valor mais recente registrado para cada KPI e a respectiva data de inserção
5. THE Portal SHALL suportar os seguintes KPIs pré-definidos: inadimplência, capacidade produtiva, congelamentos, NPS e CSAT, e permitir que um Administrador configure até 20 KPIs adicionais por Área, definindo para cada um: nome (máximo 60 caracteres) e unidade de medida (percentual, número inteiro ou número decimal)

### Requisito 11: Diretório de Membros

**User Story:** Como um membro, eu quero visualizar a lista de todos os membros da empresa, para que eu possa identificar colegas e suas funções.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o módulo de Membros, THE Portal SHALL exibir a lista de todos os membros ativos ordenada alfabeticamente por nome, contendo para cada membro: nome, cargo/função e Área à qual pertence
2. WHEN um Usuário aplica um filtro por Área, THE Portal SHALL exibir apenas os membros pertencentes à Área selecionada, mantendo a ordenação alfabética por nome
3. IF o filtro por Área selecionado não retornar nenhum membro, THEN THE Portal SHALL exibir uma mensagem informando que não há membros cadastrados na Área selecionada
4. THE Portal SHALL permitir filtrar membros por qualquer uma das Áreas cadastradas (Vendas, Presidência, Projetos, Marketing, Gestão de Pessoas, Adm-Fin) e por uma opção que exiba todos os membros sem filtro

### Requisito 12: Perfil do Usuário

**User Story:** Como um membro, eu quero editar meu perfil, para que minhas informações estejam sempre atualizadas.

#### Critérios de Aceitação

1. WHEN um Usuário acessa a página de Perfil, THE Portal SHALL exibir os dados atuais: nome, área (somente leitura), cargo (somente leitura), email, telefone e CPF
2. WHEN um Usuário edita os campos editáveis (nome, email, telefone, CPF) e salva, THE Portal SHALL atualizar as informações no sistema e exibir mensagem de confirmação
3. THE Portal SHALL validar o formato dos campos editáveis: email (formato válido RFC 5322), telefone (formato brasileiro com DDD, 10 ou 11 dígitos), CPF (11 dígitos com validação de dígitos verificadores)
4. IF um Usuário submete dados em formato inválido, THEN THE Portal SHALL exibir mensagens de erro específicas para cada campo inválido sem descartar os dados já preenchidos nos demais campos

### Requisito 13: Portfólio de Serviços

**User Story:** Como um membro, eu quero consultar o portfólio de serviços da empresa, para que eu possa conhecer todas as ofertas disponíveis.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o módulo de Portfólio, THE Portal SHALL exibir a lista de todos os serviços oferecidos pela empresa, ordenados alfabeticamente por nome, exibindo até 50 serviços por página
2. THE Portal SHALL exibir para cada serviço: nome (máximo 100 caracteres) e descrição (máximo 1000 caracteres)
3. WHEN um Administrador ou Diretor submete o formulário de adição de serviço com nome (mínimo 3 caracteres) e descrição (mínimo 10 caracteres) preenchidos, THE Portal SHALL registrar o serviço e exibir mensagem de confirmação de cadastro
4. WHEN um Administrador ou Diretor submete o formulário de edição de um serviço existente com dados válidos, THE Portal SHALL atualizar as informações do serviço e exibir mensagem de confirmação de atualização
5. IF um Administrador ou Diretor submete o formulário de adição ou edição com nome ou descrição em branco ou abaixo do mínimo de caracteres, THEN THE Portal SHALL exibir mensagem de erro indicando os campos inválidos e não registrar o serviço
6. IF um Usuário sem papel de Administrador ou Diretor tenta adicionar ou editar um serviço, THEN THE Portal SHALL negar a operação e não exibir as opções de adição e edição para esse Usuário

### Requisito 14: Gestão de Projetos

**User Story:** Como um membro, eu quero visualizar os projetos da empresa, para que eu possa acompanhar o andamento dos trabalhos.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o módulo de Projetos, THE Portal SHALL exibir a lista de todos os projetos com nome e status, ordenada alfabeticamente por nome, exibindo no máximo 50 projetos por página
2. THE Portal SHALL categorizar projetos nos seguintes status: em andamento, concluído, congelado, cancelado
3. WHEN um Usuário seleciona um projeto, THE Portal SHALL exibir os detalhes: nome, descrição (até 2000 caracteres), lista de membros da equipe e status atual
4. WHEN um Usuário com papel de Administrador altera o status de um projeto, THE Portal SHALL registrar a mudança exibindo o status anterior, o novo status, o nome do Usuário responsável e a data da alteração no histórico do projeto
5. THE Portal SHALL permitir filtrar projetos por status, e WHEN nenhum projeto corresponder ao filtro selecionado, THE Portal SHALL exibir uma mensagem indicando que não há projetos com o status escolhido
6. IF um Usuário sem papel de Administrador tenta alterar o status de um projeto, THEN THE Portal SHALL impedir a alteração e exibir uma mensagem indicando que o Usuário não possui permissão para esta ação

### Requisito 15: Mural de Comunicados

**User Story:** Como um membro, eu quero visualizar comunicados da empresa, para que eu possa me manter informado sobre avisos importantes.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o módulo de Comunicados, THE Portal SHALL exibir até 20 comunicados por página em formato de mural, ordenados do mais recente para o mais antigo, com paginação para acessar comunicados anteriores
2. WHEN um Diretor, Gerente ou Coordenador submete um comunicado com título (máximo 150 caracteres) e conteúdo (máximo 5000 caracteres) preenchidos, THE Portal SHALL publicar o comunicado no mural com título, conteúdo, nome do autor e data de publicação
3. IF um Membro tenta criar um comunicado, THEN THE Portal SHALL bloquear a ação e exibir mensagem informando que apenas Diretores, Gerentes e Coordenadores podem publicar
4. THE Portal SHALL exibir o nome do autor e a data de publicação de cada comunicado no mural
5. IF um Diretor, Gerente ou Coordenador tenta submeter um comunicado com título ou conteúdo vazio, ou com título excedendo 150 caracteres, ou conteúdo excedendo 5000 caracteres, THEN THE Portal SHALL bloquear a publicação e exibir mensagem indicando os campos inválidos
6. IF não existem comunicados publicados, THEN THE Portal SHALL exibir mensagem informando que não há comunicados disponíveis

### Requisito 16: Enquetes

**User Story:** Como um diretor ou gerente, eu quero criar enquetes, para que eu possa coletar opiniões dos membros de forma organizada.

#### Critérios de Aceitação

1. WHEN um Diretor ou Gerente cria uma Enquete, THE Portal SHALL registrar a Enquete com título (máximo 150 caracteres), descrição (máximo 2000 caracteres) e no mínimo 2 e no máximo 10 opções de múltipla escolha (cada opção com no máximo 200 caracteres)
2. WHEN um Usuário vota em uma Enquete, THE Portal SHALL registrar o voto associado à identidade do Usuário (voto identificado) e confirmar o registro do voto ao Usuário
3. WHEN um Usuário acessa uma Enquete, THE Portal SHALL exibir as opções com a contagem de votos por opção e a lista de nomes dos Usuários que votaram em cada opção
4. IF um Usuário tenta votar mais de uma vez na mesma Enquete, THEN THE Portal SHALL bloquear o voto e exibir mensagem informando que o Usuário já votou nesta Enquete
5. IF um Membro ou Coordenador tenta criar uma Enquete, THEN THE Portal SHALL bloquear a ação e informar que apenas Diretores e Gerentes podem criar enquetes
6. WHEN um Diretor ou Gerente encerra uma Enquete, THE Portal SHALL alterar o estado da Enquete para encerrada, impedir novos votos e manter os resultados visíveis para consulta

### Requisito 17: Configurações

**User Story:** Como um usuário, eu quero acessar configurações do sistema, para que eu possa personalizar minha experiência.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o módulo de Configurações, THE Portal SHALL exibir opções de configuração de perfil (alterar senha, foto de perfil)
2. WHEN um Administrador acessa o módulo de Configurações, THE Portal SHALL exibir as opções de perfil do critério 1 e opções administrativas adicionais (gerenciamento de áreas, configurações gerais do sistema)
3. WHEN um Usuário submete uma alteração de senha informando a senha atual correta e uma nova senha entre 8 e 128 caracteres contendo pelo menos uma letra maiúscula, uma minúscula e um número, THE Portal SHALL atualizar a credencial e exibir confirmação de sucesso
4. IF um Usuário submete uma alteração de senha com a senha atual incorreta ou com a nova senha fora dos critérios de validação, THEN THE Portal SHALL rejeitar a alteração, manter a senha anterior inalterada e exibir mensagem indicando o motivo da falha
5. WHEN um Usuário submete uma nova foto de perfil em formato PNG ou JPG com tamanho máximo de 5 MB, THE Portal SHALL atualizar a foto de perfil exibida no sistema
6. IF um Usuário submete uma foto de perfil em formato não suportado ou com tamanho superior a 5 MB, THEN THE Portal SHALL rejeitar o envio e exibir mensagem indicando a restrição violada

### Requisito 18: Sistema de Pontuação (Infrações)

**User Story:** Como um membro da equipe de Gestão de Pessoas, eu quero registrar infrações dos membros, para que possamos acompanhar o comportamento e aplicar medidas corretivas.

#### Critérios de Aceitação

1. WHEN um membro da equipe de Gestão de Pessoas registra uma infração, THE Portal SHALL criar o registro com tipo (atraso, falta, dress code), data da ocorrência (não superior à data atual), membro infrator e pontuação associada ao tipo selecionado, onde cada tipo de infração possui um valor de pontos pré-configurado
2. THE Portal SHALL calcular a pontuação acumulada de cada membro como a soma dos pontos de todas as infrações registradas dentro do semestre vigente
3. WHILE um Usuário pertence à equipe de Gestão de Pessoas ou possui nível Diretor, THE Portal SHALL permitir a visualização da pontuação de todos os membros
4. IF um Usuário sem permissão tenta acessar o módulo de Pontuação de outros membros, THEN THE Portal SHALL bloquear o acesso e informar que a funcionalidade é restrita
5. WHEN um Usuário acessa sua própria pontuação, THE Portal SHALL exibir o histórico de infrações do semestre vigente e a pontuação acumulada, ordenado da infração mais recente para a mais antiga
6. IF um membro da equipe de Gestão de Pessoas tenta registrar uma infração com campos obrigatórios não preenchidos (tipo, data, membro infrator), THEN THE Portal SHALL rejeitar o registro e exibir mensagem indicando os campos pendentes
7. WHEN um membro da equipe de Gestão de Pessoas ou Diretor solicita a remoção de uma infração registrada por erro, THE Portal SHALL permitir a exclusão do registro e recalcular a pontuação acumulada do membro afetado

### Requisito 19: Reserva de Computadores

**User Story:** Como um membro, eu quero reservar um computador, para que eu possa garantir disponibilidade quando precisar usar.

#### Critérios de Aceitação

1. WHEN um Usuário acessa o módulo de Reserva de Computadores, THE Portal SHALL exibir a disponibilidade dos 7 computadores para os próximos 7 dias corridos a partir do dia seguinte
2. WHEN um Usuário solicita uma reserva válida (que não viola nenhuma regra), THE Portal SHALL registrar a reserva para o computador e dia selecionados e exibir uma confirmação com o computador reservado e a data correspondente
3. IF um Usuário tenta reservar mais de um computador para o mesmo dia, THEN THE Portal SHALL rejeitar a solicitação e exibir uma mensagem informando que o limite é de 1 computador por dia
4. IF um Usuário tenta reservar um computador para o dia atual ou para um dia já passado, THEN THE Portal SHALL rejeitar a solicitação e exibir uma mensagem informando que a reserva deve ser feita com pelo menos 1 dia de antecedência
5. IF um Usuário tenta reservar um computador e já possui reservas em 2 dias consecutivos imediatamente anteriores ou posteriores ao dia solicitado (formando uma sequência de 3 dias consecutivos), THEN THE Portal SHALL rejeitar a solicitação e exibir uma mensagem informando que não é permitido reservar por 3 dias consecutivos
6. IF todos os 7 computadores já estão reservados para o dia selecionado, THEN THE Portal SHALL exibir o dia como indisponível e impedir a seleção
7. WHEN um Usuário cancela uma reserva cuja data é posterior ao dia atual, THE Portal SHALL remover a reserva e liberar o computador para outros Usuários

### Requisito 20: Responsividade

**User Story:** Como um membro, eu quero acessar o Portal de qualquer dispositivo, para que eu possa usar o sistema em desktop, tablet ou celular.

#### Critérios de Aceitação

1. WHILE a largura do viewport for superior a 1024px, THE Portal SHALL exibir o layout desktop com menu lateral visível e conteúdo sem rolagem horizontal
2. WHILE a largura do viewport estiver entre 768px e 1024px, THE Portal SHALL exibir o layout tablet com menu lateral recolhível e conteúdo reorganizado em uma única coluna quando necessário, sem rolagem horizontal
3. WHILE a largura do viewport for inferior a 768px, THE Portal SHALL exibir o layout mobile com menu acessível via botão hamburger, conteúdo em coluna única e elementos interativos com área de toque mínima de 44x44px
4. THE Portal SHALL manter todas as funcionalidades navegáveis e operáveis sem rolagem horizontal em viewports com largura mínima de 320px
5. WHEN o usuário redimensionar a janela do navegador ou rotacionar o dispositivo, THE Portal SHALL ajustar o layout ao breakpoint correspondente sem necessidade de recarregar a página
