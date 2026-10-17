# Especificação Técnica — Fase 4: Rede P2P, Relays Cegos e Descentralização

**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Módulos Contemplados:** Bloco 4 (Rede P2P WebRTC, Nós Relays Cegos via WebSockets & Sincronização Merkle DAG)

---

## 1. Objetivo da Fase 4

Interconectar nós independentes em uma **rede descentralizada, resiliente e indestrutível**, sem depender de servidores proprietários, bancos de dados em nuvem corporativos ou aprovações de lojas de aplicativos.

Nesta fase, o protocolo entrega:

1. **Comunicação Direta WebRTC (P2P Celular-a-Celular):** Conexão direta entre os 10 membros da célula ativa para transmissão volátil de chat e sincronização de rascunhos em tempo real com latência mínima e custo zero de banda de servidor.
2. **Nós Relays Cegos (Blind Relays via WebSockets):** Servidores comunitários ultraleves e neutros. Qualquer pessoa ou coletivo sobe um nó em **1 comando Docker** para manter a rede sempre online e imune à censura.
3. **Arquitetura Invisível em Duas Camadas:** O smartphone (PWA) não sofre drenagem de bateria porque não mantém centenas de conexões P2P abertas; ele se conecta sob demanda a 2 ou 3 relays comunitários simultâneos.
4. **Transporte Efêmero sem Custódia:** Bate-papo descartável transmitido de forma volátil, auto-destrutível após a consolidação da célula, sem jamais poluir o Merkle DAG.
5. **Sincronização Offline-First:** Nós que passam horas ou dias desconectados baixam os deltas dos commits assinados e reconciliam o estado automaticamente ao reabrir o PWA.

---

## 2. Dependências Open Source

```bash
# No cliente PWA (Web / Navegador):
npm install @noble/ed25519 @noble/hashes

# No nó de Relay Comunitário (Docker / Node.js ultraleve):
npm install ws
npm install -D typescript @types/ws vitest
```

* **WebRTC Nativo (`RTCPeerConnection` / `RTCDataChannel`)**: API nativa de todos os navegadores modernos, sem bibliotecas pesadas de terceiros.
* **WebSockets Nativo (`WebSocket` no cliente / `ws` no servidor)**: Transporte bidirecional de baixíssima sobrecarga.
* **`@noble/ed25519`**: Validação determinística das assinaturas de envelope antes da retransmissão.

---

## 3. Estrutura de Diretórios Recomendada

```
packages/network/
├── src/
│   ├── client/
│   │   ├── relay_pool.ts       # Gestão de conexão simultânea a múltiplos relays (com failover)
│   │   ├── envelope.ts         # Envelopamento e verificação de mensagens assinadas Ed25519
│   │   └── topic_bus.ts        # Inscrição e difusão em tópicos comunitários
│   ├── webrtc/
│   │   ├── cell_mesh.ts        # Malha direta DataChannel entre os 10 assentos da célula
│   │   └── signaling.ts        # Sinalização (SDP / ICE) roteada de forma cega via Relays
│   ├── sync/
│   │   ├── dag_sync.ts         # Reconciliação rápida de branches do Merkle DAG
│   │   └── delta_fetcher.ts    # Download em lote de commits faltantes
│   ├── relay/
│   │   ├── server.ts           # Implementação do Relay Cego WebSocket
│   │   ├── store.ts            # Buffer circular em memória/disco dos commits recentes
│   │   └── Dockerfile          # Imagem oficial pronta para deploy em 1 comando
│   └── index.ts
└── test/
    ├── relay_pool.spec.ts
    ├── webrtc_mesh.spec.ts
    └── dag_sync.spec.ts
```

---

## 4. Arquitetura em Duas Camadas (PWA Mobile-Friendly)

```
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│     Cidadão A (PWA no Celular)  │               │     Cidadão B (PWA no Celular)  │
│  • WebAuthn + Chave Ed25519     │   WebRTC      │  • WebAuthn + Chave Ed25519     │
│  • Sincroniza sob demanda       │◄─────────────►│  • Sincroniza sob demanda       │
│  • Canal Efêmero da Célula      │  (Direto P2P) │  • Canal Efêmero da Célula      │
└────────────────┬────────────────┘               └────────────────┬────────────────┘
                 │                                                 │
      WebSocket  │ (Envelopes Assinados)                WebSocket  │ (Envelopes Assinados)
                 ▼                                                 ▼
     ══════════════════════════════════════════════════════════════════════════
               REDE DE NÓS RELAYS CEGOS (Comunitários 24/7)
       • Qualquer pessoa sobe com 1 comando Docker (VPS, Raspberry Pi, PC)
       • Zero custódia / Relays não possuem chaves privadas
       • Roteamento cego de envelopes assinados e sinalização WebRTC
     ══════════════════════════════════════════════════════════════════════════
                 ▲                                                 ▲
                 │              Troca de Commits Recentes          │
                 └─────────────────────────────────────────────────┘
```

### Por que os Relays são "Cegos" (Blind Relays):
1. **Imunidade a Adulteração:** Todo pacote transmitido é envelopado e assinado digitalmente com `Ed25519`. Se o operador do relay tentar alterar uma única vírgula de uma proposta ou voto, o hash SHA-256 e a assinatura tornam-se inválidos, e os clientes descartam a mensagem instantaneamente.
2. **Privacidade e Resistência a Mandados:** Os relays não guardam contas, senhas nem identidade dos usuários. Se um relay for apreendido ou censurado, o PWA simplesmente chaveia em milissegundos para o próximo relay configurado na lista do usuário.
3. **Facilidade Operacional:** Manter um relay não exige bancos relacionais pesados nem configurações complexas.

---

## 5. Como Subir um Nó Relay Comunitário em 1 Comando

Qualquer apoiador do protocolo pode ajudar a rede a permanecer indestrutível rodando um contêiner Docker:

```bash
docker run -d \
  --name pfscd-relay \
  --restart unless-stopped \
  -p 8080:8080 \
  -e MAX_HISTORY=5000 \
  sintetizing/relay:latest
```

### 5.1. Dockerfile Oficial do Relay Cego
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 8080
USER node
CMD ["node", "dist/relay/server.js"]
```

---

## 6. Implementação Prática dos Módulos

### 6.1. Cliente Multi-Relay com Fallback Automático (`relay_pool.ts`)

```typescript
export interface SignedEnvelope {
  topic: string;             // ex: "pfscd:v2:comm:COMMUNITY_ID:commits"
  sender_pubkey: string;     // Chave Ed25519 do autor
  payload: string;           // JSON serializado (commit, voto ou sinalização)
  signature: string;        // Assinatura Ed25519 em hexadecimal
  timestamp: number;
}

export class RelayPoolClient {
  private sockets: Map<string, WebSocket> = new Map();
  private subscribers: Map<string, Set<(env: SignedEnvelope) => void>> = new Map();

  constructor(private relayUrls: string[]) {}

  async connectAll(): Promise<void> {
    for (const url of this.relayUrls) {
      try {
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log(`[RelayPool] Conectado ao relay: ${url}`);
          // Reassina os tópicos ativos
          for (const topic of this.subscribers.keys()) {
            ws.send(JSON.stringify({ action: "sub", topic }));
          }
        };

        ws.onmessage = (event) => {
          const envelope: SignedEnvelope = JSON.parse(event.data);
          this.notifySubscribers(envelope);
        };

        ws.onclose = () => {
          console.warn(`[RelayPool] Conexão perdida com ${url}, reconectando em 5s...`);
          setTimeout(() => this.reconnect(url), 5000);
        };

        this.sockets.set(url, ws);
      } catch (err) {
        console.error(`[RelayPool] Falha ao conectar em ${url}`, err);
      }
    }
  }

  // Publica em TODOS os relays conectados para redundância máxima
  broadcast(envelope: SignedEnvelope): void {
    const payload = JSON.stringify({ action: "pub", envelope });
    for (const [url, ws] of this.sockets.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  subscribe(topic: string, callback: (env: SignedEnvelope) => void): () => void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
      // Notifica os relays
      for (const ws of this.sockets.values()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: "sub", topic }));
        }
      }
    }

    this.subscribers.get(topic)!.add(callback);
    return () => this.subscribers.get(topic)?.delete(callback);
  }

  private notifySubscribers(envelope: SignedEnvelope): void {
    const handlers = this.subscribers.get(envelope.topic);
    if (handlers) {
      for (const handler of handlers) {
        handler(envelope);
      }
    }
  }

  private reconnect(url: string): void {
    this.sockets.delete(url);
    this.connectAll();
  }
}
```

### 6.2. Malha Direta WebRTC para a Célula de 10 (`cell_mesh.ts`)

Os 10 participantes da célula usam o Relay apenas para trocar as ofertas e respostas SDP (Signaling). Uma vez estabelecido o canal `RTCDataChannel`, a conversa e os rascunhos trafegam **100% ponto a ponto**:

```typescript
export class CellWebRtcMesh {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  constructor(
    private myPersonaId: string,
    private relayPool: RelayPoolClient,
    private cellId: string,
    private onMessageReceived: (senderId: string, data: any) => void
  ) {
    this.listenSignaling();
  }

  private get signalingTopic(): string {
    return `pfscd:v2:cell:${this.cellId}:signaling`;
  }

  private listenSignaling(): void {
    this.relayPool.subscribe(this.signalingTopic, (envelope) => {
      const msg = JSON.parse(envelope.payload);
      if (msg.targetPersonaId !== this.myPersonaId) return;

      if (msg.type === "offer") {
        this.handleOffer(msg.senderPersonaId, msg.sdp);
      } else if (msg.type === "answer") {
        this.handleAnswer(msg.senderPersonaId, msg.sdp);
      } else if (msg.type === "candidate") {
        this.handleCandidate(msg.senderPersonaId, msg.candidate);
      }
    });
  }

  async sendToCell(data: any): Promise<void> {
    const payload = JSON.stringify(data);
    for (const channel of this.dataChannels.values()) {
      if (channel.readyState === "open") {
        channel.send(payload);
      }
    }
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.onMessageReceived(peerId, data);
    };
    this.dataChannels.set(peerId, channel);
  }

  // Métodos de negociação SDP e ICE simplificados para brevidade
  private async handleOffer(fromPeer: string, sdp: RTCSessionDescriptionInit) { /* ... */ }
  private async handleAnswer(fromPeer: string, sdp: RTCSessionDescriptionInit) { /* ... */ }
  private async handleCandidate(fromPeer: string, candidate: RTCIceCandidateInit) { /* ... */ }
}
```

---

## 7. Sincronização do Merkle DAG (Offline-First)

Quando o cidadão abre o PWA após dias desconectado:

1. **Troca de Hashes de Cabeça (*Head Hashes*):** O PWA envia aos Relays conectados os hashes mais recentes que possui em seu armazenamento local (`latest_commit_hashes`).
2. **Download em Lote dos Deltas:** O Relay responde imediatamente com o conjunto de commits assinados que o cliente ainda não viu.
3. **Validação Determinística em 5 Passos:** O cliente valida assinatura por assinatura (`Ed25519`), regras de quórum e integridade do DAG antes de gravar no banco local (`SQLite WASM` / `IndexedDB`).
4. **Fechamento de Conexão:** Concluído o sync, o PWA pode desconectar e operar localmente sem consumo de dados de segundo plano.

---

## 8. Critérios de Aceite (Definition of Done)

1. **Deploy Instantâneo do Relay:** Uma pessoa leiga consegue colocar um nó relay no ar com apenas 1 comando Docker em menos de 2 minutos.
2. **Tolerância a Censura de Relays:** Se 2 de 3 relays forem derrubados durante a votação de uma proposta, a aplicação continua recebendo votos e transmitindo mensagens pelo relay remanescente sem falha perceptível para o usuário.
3. **Privacidade no Chat Efêmero:** O chat da célula é transmitido via WebRTC direto entre os aparelhos; ao aprovar a proposta ou clivar a célula, as mensagens são expurgadas da memória local e nenhuma mensagem fica gravada no Merkle DAG.
4. **Desempenho no Mobile:** O PWA carrega e sincroniza a proposta em conexões móveis (3G/4G) em menos de 1,5 segundo.
