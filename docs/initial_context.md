
# CONTEXTO DE PROJETO: Protocolo Fractal de Síntese e Consenso Dinâmico 

## 1. Origem e Problema Diagnosticado

A conversa iniciou com uma análise comparativa dos dados socioeconômicos dos governos Bolsonaro e Lula (PIB, inflação, desemprego, fiscal, desmatamento, segurança, saúde e educação).
O diagnóstico principal foi:

- Fontes oficiais sofrem "cherry-picking" em períodos eleitorais (recortes arbitrários, correlação vs. causalidade, termos nominais vs. reais).
- O poder decisório real no Brasil é hiperconcentrado em poucas centenas de indivíduos (cúpula do Congresso/Centrão via orçamento secreto e emendas impositivas, 11 ministros do STF, lideranças financeiras/agronegócio e corporações de estado).
- Conclusão do usuário: Pressões populares pontuais (protestos de rua) e reformas institucionais tradicionais falham historicamente porque são passageiras e as oligarquias se recompõem. É necessário um sistema algorítmico e descentralizado permanente que organize a deliberação popular de forma sustentável e assíncrona (compatível com a rotina de quem trabalha).

## 2. Visão Conceitual do Usuário

O usuário propôs um modelo de coordenação civil inspirado no Git e em redes distribuídas, baseado em:

- Participação fractal assíncrona (aproveitando o tempo que as pessoas já gastam em redes sociais, transporte, etc.);
- Debate estruturado em células pequenas (10 pessoas) escolhidas por sorteio aleatório sequencial, sem intermediários com superpoderes (técnicos e especialistas participam como membros comuns de 10);
- Síntese de propostas que escalam de nível (10 ➔ 100 ➔ 1.000) gerando um ranking dinâmico de versões concorrentes;
- Protocolo de consenso dinâmico: o quórum e a velocidade de aprovação são elásticos — quanto maior a adesão, menor o tempo de espera (com travas de segurança/carência);
- Contestação construtiva: ninguém "trava" ou "vota contra" no vazio; para barrar uma proposta, o dissidente precisa redigir uma alternativa concreta e convencer os votos a migrarem para ela;
- Roda giratória: a qualquer momento as bases solicitam revisão, reabrindo sorteios para novas pessoas nas instâncias superiores (impedindo a formação de caciques).

## 3. Modelo Ontológico Universal (PFS-CD v2.0+)

Para superar a toxicidade da "seção de comentários" das redes sociais da Web 2.0, o sistema foi formalizado em 3 entidades canônicas:

1. Persona: Identidade única (1 pessoa real = 1 Persona), descentralizada, baseada em chaves criptográficas (Ed25519) e Prova de Humanidade (ZKP), sem contadores de seguidores/curtidas.
2. Community: O contexto territorial ou temático (escola, condomínio, bairro, cidade, cooperativa) que define suas próprias regras e parâmetros (vetor Omega_C).
3. Proposal: Objeto vivo e versionado que substitui o "post". É polimórfica:
   - Ação com Prazo (executável, orçamentos, festas, mutirões);
   - Normativa / Lei (código de condomínio, legislação municipal, emendas);
   - Fato / Evidência (combate a fake news e fofocas locais com agregação de fontes);
   - Incubadora (discussões reflexivas de longo prazo).

## 4. Regras Operacionais e Matemáticas Consolidadas

- Regra de Transbordo (Beta-Split): Cada nó base tem K=10 membros. Novos ingressantes entram como observadores/votantes até Beta=3 (total 13). Ao atingir 13, ocorre clivagem atômica: o nó original (10) fecha sua síntese e os 3 excedentes tornam-se a semente de um novo nó irmão paralelo que atrai mais 7 membros por sorteio (VRF).
- Função do Timelock Dinâmico: A janela de contestação T(v) reduz de forma inversamente proporcional aos votos favoráveis 'v'.
  * Se v = Quórum Mínimo (ex: 5/10), timer = T_max (ex: 10 dias).
  * Se v = 9/10, timer = T_grace (ex: 2 dias).
  * Se v = 10/10 (unanimidade), aprovação imediata (0 dias).
  * Se os votos caírem abaixo do quórum ou migrarem para uma contraproposta, o timer estica novamente.
  * Inanição: Se não atingir quórum em Delta_t, sofre garbage collection e é arquivado.
- Governança de Exclusão:
  * Exclusão de Membro: Escopo local (nunca ban global), exige template formal de violação, provas criptográficas, superquórum de 75-80% e contraditório compulsório (7 a 14 dias). Histórico passado no DAG permanece imutável.
  * Dissolução de Comunidade: Exige superquórum de >=80% e carência de 30 dias. Direito inalienável ao Fork (dissidentes podem clonar o DAG e continuar). Hibernação automática por inatividade (>180 dias).

## 5. Arquitetura Técnica P2P

- Verificação Client-Side (sem servidores centrais de API): Cada cliente/dispositivo móvel roda um daemon local verificador.
- Event-Sourced Merkle DAG: Cada voto, merge ou proposta é um commit assinado com SHA-256 e Ed25519, propagado via rede Gossip (libp2p). Se alguém adulterar as regras localmente, os nós vizinhos rejeitam deterministicamente os blocos inválidos.
- Ingestão a Frio (Cold Start): O protocolo prevê a ingestão de toda a legislação pública existente (municipal, estadual, federal), traduzida por IA para linguagem cotidiana e disposta no template padrão de proposta (Problema, Solução, Recursos, Métricas), permitindo que a população faça "forks" e melhorias em leis reais.

## 6. Estado Atual do Projeto

O Whitepaper técnico completo (v2.2) já foi formalizado e estruturado em formato Markdown com esquemas matemáticos e especificações de JSON Schemas (CommunityGenesis, ProposalObject e StateEventCommit). O foco futuro reside na prototipagem da interface (UI/UX) e na implementação do MVP do protocolo.
