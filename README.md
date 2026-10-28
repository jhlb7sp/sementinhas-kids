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
