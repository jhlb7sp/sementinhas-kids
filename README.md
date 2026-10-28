# Sementinhas Kids 🌱

Sistema offline de escalas do ministério infantil da Igreja Semear e Colher.

## Abrir o projeto
Abra `index.html` no Chrome ou Edge. Não há dependências obrigatórias para a versão web. 
Para servidor local (opcional), use `python -m http.server 8080` e acesse `http://localhost:8080`.

## Organização
- `index.html`: estrutura das páginas
- `src/css/style.css`: cores, responsividade e impressão
- `src/js/core.js`: cadastro inicial, persistência e calendário
- `src/js/escala.js`: geração de escalas
- `src/js/interface.js`: tela e formulário de eventos
- `src/js/validacao.js`: regras e validações
- `src/js/equipe.js`: histórico e cadastro da equipe
- `src/js/exportacao.js`: CSV e arquivos
- `src/js/app.js`: eventos da interface e inicialização
- `src/assets/`: logotipos

Os scripts são arquivos JavaScript tradicionais carregados em ordem com `defer`, preservando
a compatibilidade com abertura offline via `file://`. Ainda compartilham estado global;
a modularização é **incremental**, não uma arquitetura de módulos ES isolados.

## Atenção aos dados
O repositório público usa uma equipe inicial vazia. Cadastre os voluntários no aplicativo; não publique seus backups JSON.

Na versão navegador, o histórico é salvo no `localStorage` do navegador/computador.
Ele **não acompanha o pendrive**. Faça exportação de backup JSON e restaure no outro computador.
Nunca envie backups reais, históricos privados ou cadastros com informações pessoais para o GitHub.

## Regras principais
- Salas de domingo recebem professor e ajudante.
- No segundo domingo, a última sala fica na Santa Ceia (Kids 3 ou Kids 4).
- Jorge e Cinthia devem atuar no mesmo domingo, em salas diferentes.
- Tita serve às terças com Michele.
- Respeitar afastamentos, disponibilidade e preferências, verificando o resultado antes de aprovar.
- Eventos especiais possuem sala e lição por professor.

## Colaboração via GitHub
1. Crie o repositório, preferencialmente **privado** durante os testes.
2. Proteja a branch `main` e trabalhe em branches como `feat/eventos` ou `fix/escala`.
3. Faça Pull Requests pequenos, explicando como testar.
4. Nunca versionar `dados/`, `backups/` nem arquivos pessoais.
5. Teste geração, edição dos eventos, exportação e histórico antes do merge.

## Estado
Esta é a reorganização inicial da v0.9, sem intenção de mudar regras. Os testes automatizados de interface
ainda precisam ser adicionados. Não considere a validação manual dispensável.


## Programações especiais por horários
Em **Gerar escala → Eventos especiais**, use **Nova programação por horários** para eventos como o Encontro com Deus.

- Informe o título do evento e acrescente quantos **dias** precisar.
- Em cada dia, acrescente **atividades com hora de início, hora de fim e tema**.
- Cada atividade aceita **vários professores e ajudantes**, cadastrados pela equipe.
- Escolha **Aula / atividade**, **Troca de equipe** ou **Intervalo / pausa**.
- A impressão agrupa as atividades por dia, mostrando horário, tema e equipes.
- O CSV inclui as linhas das programações com horário e tema.
- A aprovação valida horários, equipe inativa, voluntários duplicados e sobreposição de horários.
- O histórico registra uma participação por pessoa e dia do evento, não uma por atividade.

A programação pode ser criada sem gerar a escala mensal. Os eventos simples existentes continuam disponíveis.

**Limitação:** os testes automatizados atuais cobrem as regras do cronograma, mas não substituem a conferência visual no Chrome/Edge antes de entregar à liderança.


## Prioridades e restrições de salas (PR #2)
No cadastro de cada professor ou ajudante, escolha apenas as salas em que a pessoa **pode** atuar, na ordem de preferência.

- **1ª prioridade — Kids 1; 2ª/3ª/4ª — Não atua:** essa pessoa pode ser escalada **somente no Kids 1**.
- Os campos **Não atua** são proibições de sala; não são apenas preferências menos importantes.
- O gerador usa somente pessoas autorizadas e apresenta erro quando não consegue preencher todas as salas.
- A validação também bloqueia atribuições manuais em salas não permitidas, inclusive nos eventos simples com sala.
- Backups antigos preservam as opções que já estão vazias, sem completá-las automaticamente.
- Não é permitido repetir a mesma sala em duas posições de prioridade.

**Importante:** salve um backup antes de alterar muitas preferências. Programações especiais por horários sem campo de sala seguem suas próprias regras; essas restrições de Kids 1–4 aplicam-se à escala de salas e aos eventos simples com sala.


## Configuração de regras e ausências
Acesse **Dados e backup → Regras de escala e disponibilidade** para ajustar as restrições sem modificar JavaScript.

- **Vínculo de dois professores:** ambos ministram no mesmo domingo, em salas diferentes. É possível cadastrar vários pares, como Matheus/Jhenifer, além dos já existentes.
- **Dupla de terça:** professor e ajudante precisam atuar juntos quando qualquer um deles for escalado na terça.
- **Ativar/desativar:** regras com vínculo podem ser desligadas temporariamente sem excluir os cadastros.
- **Máximo por mês:** configure valor padrão para professores e ajudantes; opcionalmente, um valor individual substitui o padrão. **0 = sem limite**.
- **Ausências por data:** escolha voluntário e dia exato; a pessoa continuará disponível nas outras datas.
- **Ajudante preferencial de terça:** escolha uma pessoa e habilite a preferência. O gerador tentará incluí-la em **uma terça**, desde que possível.

A contagem dos limites considera **dias distintos de serviço** no mês, somando cultos e eventos. Dois períodos do mesmo evento no mesmo dia contam uma participação; sábado e domingo contam duas.

**Regras de migração:** quando o cadastro anterior contiver Jorge/Cinthia, Michele/Tita e Felipe, as regras anteriores são transformadas em configurações (e podem ser desabilitadas). As regras usam IDs dos cadastros, portanto continuam válidas após renomear alguém. Backups JSON armazenam as configurações.

**Conflitos:** se não houver professores ou ajudantes suficientes, ou uma regra impedir preencher as salas, o gerador mostra um erro e não aprova uma escala inválida. PDF e CSV também são bloqueados se a validação identificar conflito.

**Escopo atual dos vínculos:** o vínculo entre dois professores se aplica aos **domingos**; a dupla professor-ajudante é obrigatória nas **terças**. Ausências e limites mensais também são verificados nos eventos. Programações por horários mantêm a possibilidade de vários voluntários por atividade.

Recomenda-se salvar um backup JSON antes de atualizar a versão e validar algumas escalas reais após o merge.


## Avisos confirmáveis e conflitos impeditivos
Na escala, existem **dois níveis** de inconsistência:

1. **Impeditivo (vermelho):** o **mesmo professor ou ajudante** está em **salas Kids diferentes na mesma data**. O sistema destaca os campos envolvidos, informa nome, salas e dia, e impede aprovar a escala e exportar PDF/CSV até a correção. A verificação considera domingos e eventos simples, inclusive entre culto e evento no mesmo dia.
2. **Aviso confirmável:** os demais descumprimentos — por exemplo, Jorge e Cinthia em domingos diferentes, ausência em uma data, limite mensal ou preferência de sala não seguida — podem ser mantidos **com confirmação explícita** da liderança.

Ao clicar **Aprovar e salvar**, **Exportar PDF**, **Exportar CSV** ou **Salvar evento/programação**, a confirmação lista até dez avisos e pergunta se deseja continuar mesmo assim. Clicar **Cancelar** não publica nem exporta. O rascunho continua salvo automaticamente para permitir ajustes.

**Atenção:** eventos simples não registram horário. Por isso, se uma pessoa constar em salas diferentes no mesmo dia, mesmo em culto/eventos distintos, a duplicidade é tratada como conflito impeditivo. Nas programações por horário sem indicação de sala, a validação de sobreposição de horas permanece como aviso confirmável.

O gerador automático ainda procura uma escala que respeite todas as regras e pode informar que não encontrou combinação. As exceções confirmadas são destinadas à **revisão manual e publicação** de uma escala editada.


## Importação de ausências pelo Google Forms (CSV)
Não é necessário hospedar o sistema. Os voluntários respondem ao Google Forms no celular; a liderança baixa as respostas pelo Google Planilhas e importa o CSV **localmente**, mesmo sem internet.

**Preparar o Google Forms:**
1. Pergunta de lista suspensa: **Qual é o seu nome?** (cadastrar os nomes da equipe).
2. Pergunta de caixas de seleção: **Quais dias você NÃO poderá servir?** (usar opções no formato "Domingo — 13/12/2026", "Terça — 15/12/2026").
3. Quem não tiver ausências **não precisa responder**.
4. Abra a planilha vinculada → **Arquivo → Fazer download → Valores separados por vírgulas (.csv)**.

**No Sementinhas Kids:** abra **Dados e backup → Importar ausências do Google Forms**; selecione o arquivo CSV; confira a prévia, os nomes identificados e as datas; ajuste manualmente nomes que não correspondem a nenhum voluntário; clique em **Confirmar importação**.

- Um voluntário pode enviar respostas separadas, cada uma com uma data. O importador **reúne todas**.
- Uma resposta pode conter **várias datas** marcadas. O leitor entende as vírgulas dentro de células entre aspas, conforme o padrão CSV do Google.
- Datas repetidas no arquivo são unificadas; ausências já cadastradas (inclusive as **manuais**) não são alteradas ou duplicadas.
- Se houver data impossível, coluna inesperada, nome sem correspondência ou resposta sem data, o sistema exige correção/associação na prévia.
- Nomes são associados sem diferenciar maiúsculas, minúsculas ou acentos, mas **não** são associados por semelhança aproximada.
- A importação é **aditiva**: não apaga ausências antigas. Caso um voluntário corrija ou cancele uma indisponibilidade já importada, remova a data antiga manualmente.
- As ausências permanecem no backup JSON do Sementinhas Kids; o CSV original não é enviado a nenhum servidor pelo aplicativo. Os dados persistem no computador/navegador utilizado.
- O gerador usa as ausências normalmente ao montar a escala.

**Atenção:** a função de importação está no projeto com arquivos separados. Para distribuir a versão em HTML único é necessário **gerar novamente** esse HTML após a atualização (um arquivo HTML antigo não recebe novas funcionalidades sozinho).
