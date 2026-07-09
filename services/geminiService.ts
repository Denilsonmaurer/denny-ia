
import React from 'react';
import { 
  GoogleGenAI, 
  Type, 
  FunctionDeclaration, 
  LiveServerMessage, 
  Modality,
} from "@google/genai";
import { ConversationMessage } from "../types";

const getApiKey = (): string => {
  const userKey = typeof window !== 'undefined' ? localStorage.getItem('userDennyApiKey') : null;
  return userKey || process.env.GEMINI_API_KEY || "";
};

export const validateApiKey = async (key: string): Promise<{ valid: boolean; message?: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: 'Hello' 
        });
        return { valid: true };
    } catch (e: any) {
        console.error("API Key Validation Error:", e);
        return { valid: false, message: e.message || 'Chave inválida' };
    }
};

async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 2, delay: number = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isQuotaError = 
            error?.status === 429 || 
            error?.code === 429 || 
            error?.error?.code === 429 || 
            error?.error?.status === 'RESOURCE_EXHAUSTED' ||
            (error?.message && (
                error.message.includes('429') || 
                error.message.includes('exhausted') || 
                error.message.includes('quota') ||
                error.message.includes('RESOURCE_EXHAUSTED')
            )) ||
            (JSON.stringify(error).includes('RESOURCE_EXHAUSTED'));

        if (maxRetries > 0 && isQuotaError) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, maxRetries - 1, delay * 2);
        }
        throw error;
    }
}

export interface LiveSessionController {
  sessionPromise: Promise<any>;
  startMicrophone: () => Promise<void>;
  stopMicrophoneInput: () => void;
  stopPlayback: () => void;
  closeSession: () => void;
  isModelSpeaking: () => boolean;
}

const switchActiveAgentFunctionDeclaration: FunctionDeclaration = {
  name: 'switchActiveAgent',
  parameters: {
    type: Type.OBJECT,
    description: 'Transfere o usuário para outro especialista.',
    properties: {
        agentName: {
            type: Type.STRING,
            description: "Nome do especialista (ex: 'programador', 'trafego', 'padrao')."
        }
    },
    required: ['agentName']
  },
};

const getCurrentDateTimeBrazilFunctionDeclaration: FunctionDeclaration = {
  name: 'getCurrentDateTimeBrazil',
  parameters: {
    type: Type.OBJECT,
    description: 'Retorna data e hora atuais no Brasil.',
    properties: {},
  },
};

const activateCameraFunctionDeclaration: FunctionDeclaration = {
    name: 'activateCamera',
    parameters: { type: Type.OBJECT, properties: {} },
    description: 'Ativa a câmera.'
};

const deactivateCameraFunctionDeclaration: FunctionDeclaration = {
    name: 'deactivateCamera',
    parameters: { type: Type.OBJECT, properties: {} },
    description: 'Desativa a câmera.'
};

const activateScreenSharingFunctionDeclaration: FunctionDeclaration = {
    name: 'activateScreenSharing',
    parameters: { type: Type.OBJECT, properties: {} },
    description: 'Inicia compartilhamento de tela.'
};

const deactivateScreenSharingFunctionDeclaration: FunctionDeclaration = {
    name: 'deactivateScreenSharing',
    parameters: { type: Type.OBJECT, properties: {} },
    description: 'Encerra compartilhamento de tela.'
};

const createFocoFlowTaskFunctionDeclaration: FunctionDeclaration = {
  name: 'createFocoFlowTask',
  parameters: {
    type: Type.OBJECT,
    description: 'Cria uma nova tarefa ou item em uma categoria de projeto no FocoFlow.',
    properties: {
      title: { type: Type.STRING, description: 'Título da tarefa ou item.' },
      description: { type: Type.STRING, description: 'Descrição detalhada.' },
      dueDate: { type: Type.STRING, description: 'Data de vencimento (ISO 8601).' },
      priority: { type: Type.STRING, description: 'Prioridade (low, medium, high).' },
      category: { type: Type.STRING, description: 'Categoria do item (ex: tarefas, ideias, objetivos, metas, melhorias, orçamentos).' },
      project_id: { type: Type.STRING, description: 'ID do projeto ao qual este item pertence (opcional).' }
    },
    required: ['title']
  }
};

const createFocoFlowProjectFunctionDeclaration: FunctionDeclaration = {
  name: 'createFocoFlowProject',
  parameters: {
    type: Type.OBJECT,
    description: 'Cria um novo projeto no FocoFlow.',
    properties: {
      name: { type: Type.STRING, description: 'Nome do projeto.' },
      description: { type: Type.STRING, description: 'Descrição do projeto.' },
      color: { type: Type.STRING, description: 'Cor hexadecimal do projeto (ex: #ff0000).' }
    },
    required: ['name']
  }
};

const createFocoFlowReminderFunctionDeclaration: FunctionDeclaration = {
  name: 'createFocoFlowReminder',
  parameters: {
    type: Type.OBJECT,
    description: 'Cria um lembrete no FocoFlow. Se o usuário disser apenas o horário, assuma que é para HOJE, a menos que ele especifique "amanhã" ou outra data.',
    properties: {
      title: { type: Type.STRING, description: 'Título do lembrete.' },
      description: { type: Type.STRING, description: 'Descrição do lembrete.' },
      dueDate: { type: Type.STRING, description: 'Data e hora do lembrete (ISO 8601). Ex: 2026-03-07T15:56:00' }
    },
    required: ['title', 'dueDate']
  }
};

const createFocoFlowTransactionFunctionDeclaration: FunctionDeclaration = {
  name: 'createFocoFlowTransaction',
  parameters: {
    type: Type.OBJECT,
    description: 'Registra uma movimentação financeira no FocoFlow (Receitas ou Despesas).',
    properties: {
      description: { type: Type.STRING, description: 'Descrição da transação (ex: "Merenda", "Salário").' },
      amount: { type: Type.NUMBER, description: 'Valor numérico.' },
      type: { type: Type.STRING, description: 'Tipo: "income" (para recebimentos/saldo) ou "expense" (para despesas/compras).' },
      category: { type: Type.STRING, description: 'Categoria (ex: Alimentação, Transporte, Lazer).' },
      origin_type: { 
          type: Type.STRING, 
          description: 'Tipo de origem para o painel FocoFlow. Valores: "receita_propria" (Receita/Entrada), "despesa_propria" (Despesa/Gasto), "emprestimo_concedido" (Empréstimo dado), "emprestimo_recebido" (Empréstimo recebido), "retorno_emprestimo" (Retorno de empréstimo), "valor_terceiro" (Valor de terceiro), "pagamento_fatura_terceiro" (Pagamento fatura terceiro), "transferencia_interna" (Transferência interna), "valor_transitorio" (Valor transitório).' 
      },
      paymentMethod: { type: Type.STRING, description: 'Método: "money" (dinheiro), "credit" (crédito), "pix", "transfer" (transferência).' },
      date: { type: Type.STRING, description: 'Data e hora (ISO 8601). Se não informado, o sistema usará a data/hora atual.' },
      observations: { type: Type.STRING, description: 'Observações adicionais.' },
      impactsEquity: { type: Type.BOOLEAN, description: 'Se impacta o patrimônio (padrão true).' }
    },
    required: ['description', 'amount', 'type']
  }
};

const getFocoFlowDataFunctionDeclaration: FunctionDeclaration = {
  name: 'getFocoFlowData',
  parameters: {
    type: Type.OBJECT,
    description: 'Busca dados do FocoFlow (tarefas, transações, projetos, links).',
    properties: {
      collectionName: { 
        type: Type.STRING, 
        description: 'Nome da coleção: use "focuflow_items" para tarefas, projetos, lembretes e links; use "focuflow_financial_transactions" para finanças.' 
      },
      limit: { type: Type.NUMBER, description: 'Limite de itens a retornar.' },
      category: { type: Type.STRING, description: 'Categoria para filtrar (ex: "task", "reminder", "link", "project"). Se não informado, retorna tudo.' },
      status: { type: Type.STRING, description: 'Status para filtrar (ex: "todo", "in_progress", "done"). Útil para buscar tarefas concluídas ou pendentes.' }
    },
    required: ['collectionName']
  }
};

const createFocoFlowLinkFunctionDeclaration: FunctionDeclaration = {
  name: 'createFocoFlowLink',
  parameters: {
    type: Type.OBJECT,
    description: 'Salva um link importante no FocoFlow.',
    properties: {
      url: { type: Type.STRING, description: 'A URL do link.' },
      title: { type: Type.STRING, description: 'Título ou descrição do link.' }
    },
    required: ['url']
  }
};

const updateFocoFlowItemFunctionDeclaration: FunctionDeclaration = {
  name: 'updateFocoFlowItem',
  parameters: {
    type: Type.OBJECT,
    description: 'Atualiza uma tarefa, projeto, lembrete ou link existente no FocoFlow.',
    properties: {
      id: { type: Type.STRING, description: 'ID do item a ser atualizado.' },
      data: { 
        type: Type.OBJECT, 
        description: 'Objeto com os campos a serem atualizados.',
        properties: {
            title: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            status: { type: Type.STRING },
            priority: { type: Type.STRING },
            category: { type: Type.STRING },
            project_id: { type: Type.STRING },
            url: { type: Type.STRING },
            reminderTime: { type: Type.NUMBER },
            color: { type: Type.STRING }
        }
      }
    },
    required: ['id', 'data']
  }
};

const deleteFocoFlowItemFunctionDeclaration: FunctionDeclaration = {
  name: 'deleteFocoFlowItem',
  parameters: {
    type: Type.OBJECT,
    description: 'Exclui uma tarefa, projeto, lembrete ou link do FocoFlow.',
    properties: {
      id: { type: Type.STRING, description: 'ID do item a ser excluído.' }
    },
    required: ['id']
  }
};

const updateFocoFlowTransactionFunctionDeclaration: FunctionDeclaration = {
  name: 'updateFocoFlowTransaction',
  parameters: {
    type: Type.OBJECT,
    description: 'Atualiza uma transação financeira existente no FocoFlow.',
    properties: {
      id: { type: Type.STRING, description: 'ID da transação a ser atualizada.' },
      data: { 
        type: Type.OBJECT, 
        description: 'Objeto com os campos a serem atualizados.',
        properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING },
            category: { type: Type.STRING },
            origin_type: { type: Type.STRING },
            paymentMethod: { type: Type.STRING },
            date: { type: Type.NUMBER },
            observations: { type: Type.STRING },
            impactsEquity: { type: Type.BOOLEAN }
        }
      }
    },
    required: ['id', 'data']
  }
};

const deleteFocoFlowTransactionFunctionDeclaration: FunctionDeclaration = {
  name: 'deleteFocoFlowTransaction',
  parameters: {
    type: Type.OBJECT,
    description: 'Exclui uma transação financeira do FocoFlow.',
    properties: {
      id: { type: Type.STRING, description: 'ID da transação a ser excluída.' }
    },
    required: ['id']
  }
};

const getMonthlyFinancialReportFunctionDeclaration: FunctionDeclaration = {
  name: 'getMonthlyFinancialReport',
  parameters: {
    type: Type.OBJECT,
    description: 'Gera um balanço financeiro do mês atual, com total de receitas, despesas e saldo.',
    properties: {},
  },
};

const searchPastConversationsFunctionDeclaration: FunctionDeclaration = {
  name: 'searchPastConversations',
  parameters: {
    type: Type.OBJECT,
    description: 'Busca em conversas passadas do usuário para relembrar fatos, preferências ou contextos anteriores.',
    properties: {
      query: { 
        type: Type.STRING, 
        description: 'Termo de busca ou pergunta sobre o passado (ex: "o que falamos sobre dieta?", "qual o nome do meu cachorro?").' 
      },
      limit: { 
        type: Type.NUMBER, 
        description: 'Número máximo de mensagens a retornar (padrão 10).' 
      }
    },
    required: ['query']
  }
};

const stopActiveAlarmFunctionDeclaration: FunctionDeclaration = {
  name: 'stopActiveAlarm',
  parameters: { type: Type.OBJECT, properties: {} },
  description: 'Para o alarme ou som de notificação que está tocando no momento.'
};

const updateUserPreferencesFunctionDeclaration: FunctionDeclaration = {
  name: 'updateUserPreferences',
  parameters: {
    type: Type.OBJECT,
    description: 'Atualiza as preferências do usuário no sistema.',
    properties: {
      themeColor: { type: Type.STRING, description: 'Nova cor do tema em formato Hexadecimal (ex: #00FF00).' },
      assistantName: { type: Type.STRING, description: 'Novo nome para o assistente (Denny).' },
      userName: { type: Type.STRING, description: 'Como o usuário prefere ser chamado.' }
    }
  }
};

function executeGetCurrentDateTimeBrazil(): string {
  const now = new Date();
  return now.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo', 
    dateStyle: 'full', 
    timeStyle: 'long' 
  });
}

export const visionSystemModuleInstruction = `
**DIRETRIZ VISUAL RESTRITA**
1. **Verdade Visual**: Analise apenas o que está explicitamente na imagem. Nunca invente elementos ou informações que não estão na tela.
2. **Status de Visão**: Você só tem permissão para dizer "estou vendo sua tela" se o compartilhamento de tela estiver ATIVO. Caso contrário, peça para o usuário ativar.
3. **Foco Instantâneo**: Identifique o conteúdo imediatamente e responda de forma ultra-concisa.
4. **Pesquisa Visual**: Se o usuário mostrar um programa, erro ou site que você não conhece totalmente, use a ferramenta de busca (Google Search) imediatamente para entender o contexto real e atual.
`.trim();

export const baseSystemInstruction = `
    IDENTIDADE: DENNY - CONSULTOR COM BUSCA EM TEMPO REAL
    Sua prioridade absoluta é velocidade, fluidez e precisão baseada em dados atuais.

    **REGRAS CRÍTICAS DE COMPORTAMENTO:**
    0. **Correção Automática**: O usuário pode cometer erros de digitação ou gramática. Corrija-os mentalmente e responda ao que ele quis dizer, sem mencionar o erro a menos que seja impossível entender.
    1. **Inteligência em Tempo Real**: Use a ferramenta Google Search para QUALQUER informação que não seja de conhecimento geral estável (notícias, preços, versões de software, clima). Se você vir algo na tela que parece desatualizado ou desconhecido, pesquise proativamente.
    2. **Gerenciamento de Tempo**: Ao criar lembretes ou tarefas com horário:
       - Se o usuário disser apenas o horário (ex: "15:56"), assuma que é para HOJE.
       - Só use amanhã se o usuário disser explicitamente "amanhã".
       - Use a ferramenta 'getCurrentDateTimeBrazil' para saber a data de hoje se tiver dúvida.
    3. **Integração FocoFlow**: Você está conectado ao FocoFlow. Você tem autonomia total para gerenciar o sistema.
       - Para CRIAR: use 'createFocoFlowTask' (para tarefas e itens de categorias de projeto), 'createFocoFlowProject' (para novos projetos), 'createFocoFlowReminder', 'createFocoFlowLink', 'createFocoFlowTransaction'.
       - Categorias de Projeto: tarefas, ideias, objetivos, metas, melhorias, orçamentos. Sempre associe a um 'project_id' se souber qual é.
       - Para BUSCAR: use 'getFocoFlowData'. IMPORTANTE: Sempre use o parâmetro 'category' para filtrar o que o usuário pediu (ex: category: "task" para tarefas, "reminder" para lembretes, "project" para projetos, "link" para links). NUNCA traga links a menos que o usuário peça explicitamente por links. Se o usuário perguntar por tarefas "concluídas", "pendentes", "feitas" ou "a fazer", use o parâmetro 'status' (ex: status: "done" para concluídas, status: "todo" para pendentes).
       - Para EDITAR: use 'updateFocoFlowItem' (para tarefas, lembretes, links, projetos) ou 'updateFocoFlowTransaction' (para finanças).
       - Para EXCLUIR: use 'deleteFocoFlowItem' ou 'deleteFocoFlowTransaction'.
       - Sempre que precisar de um ID para editar ou excluir, use 'getFocoFlowData' primeiro para encontrar o item correto.
       - **REGRAS FINANCEIRAS (FocoFlow)**:
         - **Campo 'origin_type' (CRÍTICO)**: Use os valores exatos abaixo para garantir que o painel exiba corretamente:
            - Receita / Entrada -> "receita_propria"
            - Despesa / Gasto -> "despesa_propria"
            - Empréstimo dado -> "emprestimo_concedido"
            - Empréstimo recebido -> "emprestimo_recebido"
            - Retorno de empréstimo -> "retorno_emprestimo"
            - Valor de terceiro -> "valor_terceiro"
            - Pagamento fatura terceiro -> "pagamento_fatura_terceiro"
            - Transferência interna -> "transferencia_interna"
            - Valor transitório -> "valor_transitorio"
         - Se o usuário falar "recebimento", "recebi", "ganhei" -> Use type: 'income' e origin_type: 'receita_propria'.
         - Se o usuário falar "comprei", "gastei", "despesa", "notei R$..." -> Use type: 'expense' e origin_type: 'despesa_propria'.
         - Se a data não for citada, NÃO PERGUNTE. Use a data e hora atual automaticamente.
         - Tente identificar o método de pagamento (Pix, cartão, dinheiro) pelo contexto.
    3. **Visualização de Dados FocoFlow**: SEMPRE que você buscar e listar dados do FocoFlow (lembretes, links, emails), use o formato especial de tag para que o sistema renderize visualmente para o usuário.
       - Para Lembretes: [[FOCOFLOW_ITEM:{"category":"reminder", "title":"Título", "reminderTime": 123456789, "description": "Opcional"}]]
       - Para Links: [[FOCOFLOW_ITEM:{"category":"link", "title":"Título do Link", "url": "https://..."}]]
       - Para Transações: [[FOCOFLOW_ITEM:{"category":"transaction", "type": "income/expense", "description": "Descrição", "amount": 100.00, "date": 123456789, "paymentMethod": "Pix"}]]
       - Para Relatório Financeiro: [[FOCOFLOW_ITEM:{"category":"financial_report", ...dados_do_relatorio}]] (Use os dados exatos retornados pela função 'getMonthlyFinancialReport').
       - Para E-mails ou textos para copiar: [[FOCOFLOW_ITEM:{"category":"copy", "content": "texto ou email"}]]
       - Use estas tags DENTRO do seu texto de resposta. Não apenas fale o link, use a tag.
    4. **Conciso e Direto**: Respostas de voz extremamente curtas (4-8 segundos). Sem "enchimento".
    5. **Aderência ao Contexto**: Responda estritamente ao que foi perguntado.
    6. **Memória Contínua e Histórica**: 
       - Você tem acesso a toda a história de conversas do usuário.
       - Se o usuário perguntar algo que você não lembra no contexto imediato (últimas 10 mensagens), use OBRIGATORIAMENTE a ferramenta 'searchPastConversations' para buscar no banco de dados.
       - Use isso para lembrar nomes, preferências, decisões passadas ou qualquer detalhe mencionado anteriormente.
    7. **Honestidade de Visão**: Só diga que está vendo algo se o STATUS VISUAL for ATIVO.
    
    ${visionSystemModuleInstruction}
`.trim();

const andromedaTrafficManagerInstruction = `
    ${visionSystemModuleInstruction}
    **IDENTIDADE: ANDROMEDA ADS (ESTRATEGISTA DIRETO)**
    Foco em Meta Ads. Use a busca para verificar tendências de criativos atuais se necessário. Respostas GPS.
`.trim();

const googleAdsAgentInstruction = `
    ${visionSystemModuleInstruction}
    **IDENTIDADE: GOOGLE ADS (CONSULTOR ANALÍTICO)**
    Foco em ROI. Use a busca para verificar volumes de palavras-chave atuais se solicitado.
`.trim();

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

export const summarizeText = async (text: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Resuma em 3 palavras: ${text.substring(0, 300)}`,
        });
        return response.text?.trim() || "Nova Conversa";
    } catch (error) {
        return "Nova Conversa";
    }
};

export const generateImage = async (prompt: string, style: string, aspectRatio: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    let arValue = "1:1";
    if (aspectRatio.includes("16:9")) arValue = "16:9";
    else if (aspectRatio.includes("9:16")) arValue = "9:16";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: { parts: [{ text: `${prompt}. Estilo: ${style}` }] },
            config: { imageConfig: { aspectRatio: arValue as any } }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) return part.inlineData.data;
        }
        throw new Error("Erro");
    } catch (error) {
        throw error;
    }
};

export const sendTextMessage = async (
    message: string,
    history: ConversationMessage[],
    agent: string,
    file: { base64: string; mimeType: string } | undefined,
    isVisualActive: boolean,
    programmingLevel?: string,
    customInstruction?: string,
    isSummarized: boolean = false,
    dennyName: string = 'Denny',
    userName: string = ''
) => {
    console.log("sendTextMessage called with:", { message, historyCount: history.length, agent });
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error("GEMINI_API_KEY is missing!");
        return { 
            text: "Erro: Chave de API não configurada. Por favor, adicione GEMINI_API_KEY nos Segredos.",
            functionCalls: []
        };
    }
    const ai = new GoogleGenAI({ apiKey });
    
    // Base instruction is always included to ensure FocoFlow and core rules work
    let systemInstruction = baseSystemInstruction;
    
    // Append agent-specific instructions
    if (agent === 'traffic_manager') systemInstruction += "\n\n" + andromedaTrafficManagerInstruction;
    else if (agent === 'google_ads') systemInstruction += "\n\n" + googleAdsAgentInstruction;
    else if (customInstruction) systemInstruction += "\n\n" + customInstruction;

    if (isSummarized) systemInstruction += "\nRESPOSTA ULTRA-CURTA (MÁXIMO 1 LINHA).";
    systemInstruction += `\nSTATUS VISUAL: ${isVisualActive ? 'ATIVO. Analise o que vê.' : 'DESATIVADO.'}`;
    systemInstruction += `\nDATA/HORA ATUAL (Brasil): ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    
    if (dennyName) systemInstruction += `\nSeu nome atual é: ${dennyName}. Sempre se identifique e responda como ${dennyName}.`;
    if (userName) systemInstruction += `\nO nome do usuário é: ${userName}. Use este nome para se referir a ele quando apropriado. Se ele perguntar qual o nome dele, responda "${userName}".`;
    else systemInstruction += `\nO usuário ainda não informou o nome dele. Se ele disser algo como "me chame de [nome]", o sistema salvará isso. Quando o usuário informar o nome dele, responda confirmando e OBRIGATORIAMENTE inclua a tag [[SET_USER_NAME:nome]] no final da sua resposta para que o sistema salve permanentemente.`;

    const recentHistory = history.slice(-20);
    const contents: any[] = [];
    
    recentHistory.forEach(msg => {
        // Skip the very last message if it's identical to the current one to avoid duplication
        if (msg.role === 'user' && msg.text === message) return;

        const role = msg.role === 'user' ? 'user' : 'model';
        const parts: any[] = [];
        
        if (msg.text) parts.push({ text: msg.text });
        if (msg.imageUrl) {
            const base64 = msg.imageUrl.includes(',') ? msg.imageUrl.split(',')[1] : msg.imageUrl;
            parts.push({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
        }
        
        if (parts.length === 0) return;

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts.push(...parts);
        } else {
            contents.push({ role, parts });
        }
    });

    const currentParts: any[] = [{ text: message }];
    if (file) currentParts.push({ inlineData: { data: file.base64, mimeType: file.mimeType } });
    
    const focoFlowKeywords = ['tarefa', 'projeto', 'lembrete', 'transação', 'finança', 'link', 'focoflow', 'foco flow', 'balanço', 'relatório', 'gasto', 'receita', 'pix', 'pagamento', 'saldo', 'dinheiro', 'custo', 'valor', 'comprei', 'vendi', 'paguei', 'recebi', 'ganhei', 'perdi', 'investi', 'economizei', 'poupança', 'banco', 'cartão', 'crédito', 'débito', 'extrato', 'movimentação'];
    const systemKeywords = ['câmera', 'tela', 'agente', 'especialista', 'alarme', 'preferência', 'nome', 'ajuda', 'suporte', 'configuração', 'tema', 'cor', 'lembra', 'conversamos', 'disse', 'falamos', 'passado', 'memória', 'histórico'];
    
    const lowerMessage = message.toLowerCase();
    const systemAgents = ['default', 'social_media', 'traffic_manager', 'google_ads', 'programmer'];
    
    const needsFunctions = systemAgents.includes(agent) || 
                           focoFlowKeywords.some(kw => lowerMessage.includes(kw)) || 
                           systemKeywords.some(kw => lowerMessage.includes(kw));
    
    // Search keywords: things that likely need real-time web info
    const searchKeywords = ['preço', 'cotação', 'notícia', 'clima', 'tempo', 'quem é', 'o que é', 'onde fica', 'como está', 'resultado', 'hoje', 'agora', 'atual', 'bitcoin', 'dólar', 'euro', 'bolsa', 'quem ganhou', 'quem venceu', 'placar', 'jogo', 'filme', 'série', 'elenco'];
    const needsSearch = searchKeywords.some(kw => lowerMessage.includes(kw));

    let tools: any[] = [];
    if (needsFunctions) {
        tools = [{ 
            functionDeclarations: [
                switchActiveAgentFunctionDeclaration,
                getCurrentDateTimeBrazilFunctionDeclaration,
                createFocoFlowTaskFunctionDeclaration,
                createFocoFlowProjectFunctionDeclaration,
                createFocoFlowReminderFunctionDeclaration,
                createFocoFlowTransactionFunctionDeclaration,
                createFocoFlowLinkFunctionDeclaration,
                getFocoFlowDataFunctionDeclaration,
                updateFocoFlowItemFunctionDeclaration,
                deleteFocoFlowItemFunctionDeclaration,
                updateFocoFlowTransactionFunctionDeclaration,
                deleteFocoFlowTransactionFunctionDeclaration,
                getMonthlyFinancialReportFunctionDeclaration,
                stopActiveAlarmFunctionDeclaration,
                updateUserPreferencesFunctionDeclaration,
                searchPastConversationsFunctionDeclaration
            ] 
        }];
    }
    
    if (needsSearch) {
        tools.push({ googleSearch: {} });
    }

    return await retryOperation(async () => {
        console.log("Sending request to Gemini with contents:", contents.length, "parts");
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...contents, { role: 'user', parts: currentParts }],
            config: { 
                systemInstruction, 
                tools
            }
        });
        console.log("Gemini response received:", response);
        return {
            text: response.text || "",
            functionCalls: response.functionCalls
        };
    });
};

export const createLiveSession = (
    callbacks: {
        onOpen: () => void;
        onClose: (e?: CloseEvent) => void;
        onError: (e: Error | ErrorEvent) => void;
        onInputTranscriptionUpdate: (text: string) => void;
        onOutputTranscriptionUpdate: (text: string) => void;
        onModelStartSpeaking: () => void;
        onModelStopSpeaking: (text: string) => void;
        onUserStopSpeaking: (text: string) => void;
        onTurnComplete: () => void;
        onInterrupt: () => void;
        onDeactivateScreenSharingCommand: () => void;
        onActivateScreenSharingCommand: () => void;
        onActivateCameraCommand: () => void;
        onDeactivateCameraCommand: () => void;
        onSwitchAgentCommand: (agentName: string) => void;
        onFocoFlowCommand: (command: string, args: any) => Promise<any>;
        onSearchPastConversationsCommand: (query: string, limit?: number) => Promise<any>;
        onStopAlarmCommand: () => void;
        onUpdateUserPreferencesCommand: (prefs: { themeColor?: string; assistantName?: string; userName?: string }) => void;
        onSessionReady: (session: any) => void;
        onAudioInputActivity?: () => void;
    },
    inputCtx: AudioContext,
    outputCtx: AudioContext,
    nextStartTimeRef: React.MutableRefObject<number>,
    micStreamRef: React.MutableRefObject<MediaStream | null>,
    audioAnalyser: AnalyserNode | null,
    history: ConversationMessage[],
    agent: string,
    isVisualActive: boolean,
    programmingLevel?: string,
    customInstruction?: string,
    voiceName: string = 'Kore',
    isSummarized: boolean = false,
    dennyName: string = 'Denny',
    userName: string = ''
): LiveSessionController => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    let systemInstruction = (agent === 'traffic_manager') ? andromedaTrafficManagerInstruction : 
                             (agent === 'google_ads') ? googleAdsAgentInstruction : 
                             (customInstruction || baseSystemInstruction);

    if (isSummarized) systemInstruction += "\nRESPOSTAS CURTAS.";
    systemInstruction += `\nSTATUS VISUAL: ${isVisualActive ? 'ATIVO. Use visão e busca se necessário.' : 'DESATIVADO.'}`;
    systemInstruction += `\nDATA/HORA ATUAL (Brasil): ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    if (dennyName) systemInstruction += `\nSeu nome atual é: ${dennyName}. Sempre se identifique e responda como ${dennyName}.`;
    if (userName) systemInstruction += `\nO nome do usuário é: ${userName}. Use este nome para se referir a ele quando apropriado. Se ele perguntar qual o nome dele, responda "${userName}".`;
    else systemInstruction += `\nO usuário ainda não informou o nome dele. Se ele disser algo como "me chame de [nome]", o sistema salvará isso. Quando o usuário informar o nome dele, responda confirmando e OBRIGATORIAMENTE inclua a tag [[SET_USER_NAME:nome]] no final da sua resposta para que o sistema salve permanentemente.`;

    const recentHistory = history.slice(-10);
    if (recentHistory.length > 0) {
        systemInstruction += `\n\nCONTEXTO RECENTE:\n${recentHistory.map(m => `${m.role}: ${m.text.substring(0, 150)}`).join('\n')}`;
    }

    let currentInputTranscription = '';
    let currentOutputTranscription = '';
    let sources = new Set<AudioBufferSourceNode>();
    let micSource: MediaStreamAudioSourceNode | null = null;
    let scriptProcessor: ScriptProcessorNode | null = null;

    // For Live Session, we must choose one toolset at the start.
    // Given the app's nature as a FocoFlow assistant, we prioritize functions.
    // However, if the agent is specifically for Ads/Marketing, we might want search.
    // To follow the "no combine" rule, we'll use functions by default for the session
    // as it's the core differentiator of the app.
    const tools: any[] = [
        { functionDeclarations: [
            switchActiveAgentFunctionDeclaration, 
            getCurrentDateTimeBrazilFunctionDeclaration, 
            activateCameraFunctionDeclaration, 
            deactivateCameraFunctionDeclaration, 
            activateScreenSharingFunctionDeclaration, 
            deactivateScreenSharingFunctionDeclaration,
            stopActiveAlarmFunctionDeclaration,
            updateUserPreferencesFunctionDeclaration,
            createFocoFlowTaskFunctionDeclaration,
            createFocoFlowProjectFunctionDeclaration,
            createFocoFlowReminderFunctionDeclaration,
            createFocoFlowTransactionFunctionDeclaration,
            createFocoFlowLinkFunctionDeclaration,
            getFocoFlowDataFunctionDeclaration,
            updateFocoFlowItemFunctionDeclaration,
            deleteFocoFlowItemFunctionDeclaration,
            updateFocoFlowTransactionFunctionDeclaration,
            deleteFocoFlowTransactionFunctionDeclaration,
            getMonthlyFinancialReportFunctionDeclaration,
            searchPastConversationsFunctionDeclaration
        ] }
    ];

    const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
            systemInstruction,
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools
        },
        callbacks: {
            onopen: () => callbacks.onOpen(),
            onmessage: async (message: LiveServerMessage) => {
                if (message.serverContent?.outputTranscription) {
                    currentOutputTranscription += message.serverContent.outputTranscription.text;
                    callbacks.onOutputTranscriptionUpdate(currentOutputTranscription);
                } else if (message.serverContent?.inputTranscription) {
                    currentInputTranscription += message.serverContent.inputTranscription.text;
                    callbacks.onInputTranscriptionUpdate(currentInputTranscription);
                }

                if (message.serverContent?.turnComplete) {
                    callbacks.onTurnComplete();
                    if (currentInputTranscription) {
                        callbacks.onUserStopSpeaking(currentInputTranscription);
                        currentInputTranscription = '';
                    }
                    if (currentOutputTranscription) {
                        const text = currentOutputTranscription.trim();
                        currentOutputTranscription = '';
                        callbacks.onModelStopSpeaking(text);
                    }
                }

                const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio) {
                    if (!currentOutputTranscription) callbacks.onModelStartSpeaking();
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                    const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), outputCtx, 24000, 1);
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioAnalyser || outputCtx.destination);
                    
                    const cleanupSource = () => {
                        if (sources.has(source)) {
                            sources.delete(source);
                            if (sources.size === 0) {
                                // Optional: notify stop speaking if needed
                            }
                        }
                    };

                    source.onended = cleanupSource;
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sources.add(source);

                    // Safety timeout in case onended doesn't fire (e.g. context suspended)
                    setTimeout(cleanupSource, (audioBuffer.duration * 1000) + 2000);
                }

                if (message.serverContent?.interrupted) {
                    callbacks.onInterrupt();
                    sources.forEach(s => { try { s.stop(); } catch(e){} });
                    sources.clear();
                    nextStartTimeRef.current = 0;
                }

                if (message.toolCall) {
                    for (const fc of message.toolCall.functionCalls) {
                        let res: any = { result: "ok" };
                        switch (fc.name) {
                            case 'switchActiveAgent': callbacks.onSwitchAgentCommand((fc.args as any).agentName); break;
                            case 'activateCamera': callbacks.onActivateCameraCommand(); break;
                            case 'deactivateCamera': callbacks.onDeactivateCameraCommand(); break;
                            case 'activateScreenSharing': callbacks.onActivateScreenSharingCommand(); break;
                            case 'deactivateScreenSharing': callbacks.onDeactivateScreenSharingCommand(); break;
                            case 'stopActiveAlarm': callbacks.onStopAlarmCommand(); break;
                            case 'updateUserPreferences': callbacks.onUpdateUserPreferencesCommand(fc.args as any); break;
                            case 'getCurrentDateTimeBrazil': res = { result: executeGetCurrentDateTimeBrazil() }; break;
                            case 'createFocoFlowTask': 
                            case 'createFocoFlowProject':
                            case 'createFocoFlowReminder':
                            case 'createFocoFlowTransaction':
                            case 'getFocoFlowData':
                            case 'updateFocoFlowItem':
                            case 'deleteFocoFlowItem':
                            case 'updateFocoFlowTransaction':
                            case 'deleteFocoFlowTransaction':
                            case 'getMonthlyFinancialReport':
                                res = await callbacks.onFocoFlowCommand(fc.name, fc.args);
                                break;
                            case 'searchPastConversations':
                                res = await callbacks.onSearchPastConversationsCommand((fc.args as any).query, (fc.args as any).limit);
                                break;
                        }
                        sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } }));
                    }
                }
            },
            onclose: (e: CloseEvent) => callbacks.onClose(e),
            onerror: (e) => callbacks.onError(e)
        }
    });

    sessionPromise.then(session => callbacks.onSessionReady(session));

    const startMicrophone = async () => {
        // Cleanup existing if any
        if (scriptProcessor) {
            scriptProcessor.disconnect();
            scriptProcessor.onaudioprocess = null;
        }
        if (micSource) {
            micSource.disconnect();
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: true, 
                noiseSuppression: true, 
                autoGainControl: true,
                sampleRate: 16000 
            } 
        });
        micStreamRef.current = stream;
        
        micSource = inputCtx.createMediaStreamSource(stream);
        scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
        
        scriptProcessor.onaudioprocess = (e) => {
            if (inputCtx.state === 'closed') return;
            
            // If model is speaking, we skip sending user audio to avoid echo
            // but we keep the processor running.
            if (sources.size > 0) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            if (callbacks.onAudioInputActivity) callbacks.onAudioInputActivity();

            sessionPromise.then(s => {
                try {
                    s.sendRealtimeInput({
                        audio: {
                            mimeType: 'audio/pcm;rate=16000',
                            data: arrayBufferToBase64(pcmData.buffer)
                        }
                    });
                } catch (err) {
                    console.error("Error sending audio data:", err);
                }
            }).catch(err => {
                // Session might be closed
            });
        };

        micSource.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);
        
        console.log("Microphone started and connected to session.");
    };

    const stopMicrophoneInput = () => {
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        if (scriptProcessor) {
            scriptProcessor.disconnect();
            scriptProcessor.onaudioprocess = null;
            scriptProcessor = null;
        }
        if (micSource) {
            micSource.disconnect();
            micSource = null;
        }
    };

    return { 
        sessionPromise, 
        startMicrophone, 
        stopMicrophoneInput, 
        stopPlayback: () => {
            sources.forEach(s => { try { s.stop(); } catch(e){} });
            sources.clear();
        }, 
        closeSession: () => {
            stopMicrophoneInput();
            sessionPromise.then(s => s.close());
        },
        isModelSpeaking: () => sources.size > 0
    };
};
