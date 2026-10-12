# Especificação Técnica — Fase 4: Descentralização, Relays e Rede P2P
**PFS-CD (Protocolo Fractal de Síntese e Consenso Dinâmico)**
**Módulos Contemplados:** Bloco 4 (Rede P2P, Relays & GossipSub)

---

## 1. Objetivo da Fase 4

Interconectar nós independentes em uma **rede descentralizada resiliente**, sem depender de nenhum servidor central, banco de dados em nuvem corporativo ou autoridade coordenadora.
Nesta fase, o protocolo viabiliza:
1. **Comunicação P2P entre Pares:** Propagação instantânea de commits e votos via protocolo Gossip.
2. **Arquitetura Invisível em Duas Camadas:** Suporte a dispositivos móveis reais (iOS/Android) através de *Light Clients* que operam sob demanda e *Relays neutros* que mantêm a fofoca ativa 24/7.
3. **Transporte Efêmero de Chat:** Envio seguro e volátil de mensagens entre os 10 membros da célula sem persistência no Merkle DAG.
4. **Sincronização Offline-First:** Nós que passam horas ou dias desconectados baixam os deltas e reconciliam o estado automaticamente ao voltar à rede.

---

## 2. Dependências Open Source

```bash
npm install libp2p @libp2p/websockets @libp2p/webrtc @chainsafe/libp2p-gossipsub @libp2p/peer-id
npm install nostr-tools @waku/sdk
npm install -D vitest
```

* **`libp2p` + `@chainsafe/libp2p-gossipsub`**: O padrão universal da Web3 para rede peer-to-peer descentralizada, com suporte a GossipSub e conexões WebRTC/WebSocket.
* **`nostr-tools`**: Ferramentas para conectar a redes de relays WebSocket ultraleves e descentralizados.
* **`@waku/sdk`**: Protocolo P2P focado em comunicação privada e eficiente para celulares, ideal para o chat efêmero com baixo consumo de bateria.

---

## 3. Estrutura de Diretórios Recomendada

```
packages/network/
├── src/
│   ├── p2p/
│   │   ├── node.ts             # Configuração do nó libp2p
│   │   ├── gossip.ts           # Tópicos GossipSub (por comunidade)
│   │   └── discovery.ts        # Descoberta de pares e WebRTC signaling
│   ├── relays/
│   │   ├── client.ts           # Conexão do Light Client com múltiplos relays
│   │   ├── nostr_adapter.ts    # Transporte de eventos assinados via relays Nostr
│   │   └── pool.ts             # Gestão de fallback e redundância de conexões
│   ├── sync/
│   │   ├── dag_sync.ts         # Protocolo de reconciliação de branches do Merkle DAG
│   │   └── delta_fetcher.ts    # Download em lote de commits faltantes
│   ├── ephemeral/
│   │   └── cell_channel.ts     # Canal volátil de chat P2P (Waku / PubSub efêmero)
│   └── index.ts
└── test/
    ├── gossip_propagation.spec.ts
    ├── relay_fallback.spec.ts
    └── dag_sync.spec.ts
```

---

## 4. Arquitetura em Duas Camadas (Mobile-Friendly)

```
┌─────────────────────────┐          ┌─────────────────────────┐
│ Cidadão A (Smartphone)  │          │ Cidadão B (Smartphone)  │
│ • Light Client          │          │ • Light Client          │
│ • WebAuthn / Passkeys   │          │ • WebAuthn / Passkeys   │
│ • Conecta sob demanda   │          │ • Conecta sob demanda   │
└────────────┬────────────┘          └────────────┬────────────┘
             │                                    │
             ▼                                    ▼
    ════════════════════════════════════════════════════════
      CAMADA DE RELAYS DESCENTRALIZADOS (Nós Neutros 24/7)
      • VPS comunitárias / Servidores domésticos / Docker
      • Zero custódia de chaves / Apenas retransmissão
    ════════════════════════════════════════════════════════
             ▲                                    ▲
             │             libp2p GossipSub       │
             └────────────────────────────────────┘
```

### Por que esta separação é indispensável:
* **Restrição de Bateria no Celular:** Dispositivos móveis modernos não permitem que aplicativos mantenham conexões P2P pesadas abertas em segundo plano.
* **Relays sem Custódia:** Os servidores da rede são meros retransmissores. Eles só aceitam pacotes que já vêm assinados com `Ed25519`. Se um relay for invadido ou malicioso, ele **não consegue forjar nenhum voto nem alterar o texto de nenhuma proposta**, pois os outros nós rejeitariam a assinatura matemática.

---

## 5. Implementação da Conexão do Nó

### 5.1. Inicialização do Nó com `libp2p` e `GossipSub`
```typescript
import { createLibp2p } from "libp2p";
import { webSockets } from "@libp2p/websockets";
import { webRTC } from "@libp2p/webrtc";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";

export async function createPfsCdNetworkNode() {
  const node = await createLibp2p({
    transports: [webSockets(), webRTC()],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      pubsub: gossipsub({
        emitSelf: false,
        allowPublishToZeroPeers: true,
      })
    }
  });

  await node.start();
  return node;
}
```

### 5.2. Inscrição em Tópicos de Comunidade e Propagação de Votos
```typescript
export class CommunityGossipManager {
  private node: any;

  constructor(node: any) {
    this.node = node;
  }

  // Tópico canônico por comunidade
  getTopic(communityId: string): string {
    return `pfscd:v2:comm:${communityId}:events`;
  }

  async subscribeToCommunity(communityId: string, onEventReceived: (commit: any) => void) {
    const topic = this.getTopic(communityId);
    this.node.services.pubsub.subscribe(topic);

    this.node.services.pubsub.addEventListener("message", (msg: any) => {
      if (msg.detail.topic === topic) {
        const jsonString = new TextDecoder().decode(msg.detail.data);
        const commit = JSON.parse(jsonString);
        onEventReceived(commit);
      }
    });
  }

  async broadcastCommit(communityId: string, signedCommit: any) {
    const topic = this.getTopic(communityId);
    const data = new TextEncoder().encode(JSON.stringify(signedCommit));
    await this.node.services.pubsub.publish(topic, data);
  }
}
```

---

## 6. Sincronização e Reconciliação do Merkle DAG (Offline-First)

Quando um cidadão fica 2 dias sem abrir o aplicativo, seu dispositivo precisa reconstruir o histórico rapidamente:

1. **Troca de Ponteiros de Cabeça (*Head Hashes*):**
   * Ao conectar, o cliente envia para os peers/relays os hashes das pontas ativas do seu grafo local (`latest_commit_hashes`).
2. **Identificação de Ancestral Comum Mais Recente (LCA):**
   * A rede compara os hashes e identifica o ponto de bifurcação onde o nó local parou.
3. **Download em Lote dos Deltas:**
   * O cliente recebe exclusivamente os commits posteriores ao ponto comum.
4. **Execução em Lote no Pipeline de Validação:**
   * Cada commit recebido passa pelo pipeline da Fase 2 antes de ser aplicado nas projeções locais do SQLite.

---

## 7. Critérios de Aceite (Definition of Done)

1. **Propagação Rápida:** Um voto emitido no Nó A deve ser recebido e validado no Nó B em menos de 1 segundo em conexões padrão de internet.
2. **Isolamento de Tópicos:** Membros da Comunidade X não recebem nem processam tráfego da Comunidade Y.
3. **Resiliência a Quedas:** Desconectar e reconectar o aplicativo recupera o estado completo do Merkle DAG sem duplicidade nem corrupção de dados.
4. **Resistência a Relays Maliciosos:** Se um relay injetar mensagens falsas ou corrompidas, o validador local descarta o pacote silenciosamente e conecta a um relay alternativo.
