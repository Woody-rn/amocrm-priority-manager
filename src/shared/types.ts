// ====СТАТУСЫ================================================

export type ClientStatus =
    | 'new'                      // 🆕 Новый
    | 'hot'                      // 🔥 Горячий
    | 'warm'                     // 🤔 Тёплый
    | 'active'                   // ⭐ Действующий
    | 'renewal'                  // 🔄 Продление
    | 'cold_competitor_software' // ⚔️ Конкурент ПО
    | 'cold_competitor_dealer'   // 🏷️ Конкурент-дилер
    | 'cold_refusal_demo'        // 📉 После демо
    | 'cold_refusal_start'       // 🥶 На старте
    | 'unclear'                  // ❓ На уточнении
    | 'dead'                     // 💀 Мёртвый
    | 'not_target'               // 🚫 Нецелевой
    | 'wild'                     // 🍒 Wild
    | 'unknown';                 // unknown status

export type StatusGroup = 'active' | 'current' | 'cold' | 'archive' | 'wild';

export interface StatusConfig {
    label: string;
    fullLabel: string;
    icon: string;
    color: string;
    className: string;
    group: StatusGroup;
    description: string;
    savable: boolean;
}

// ====КЛИЕНТ=================================================

export interface Client {
    id: string;
    name: string;
    status: ClientStatus;
    leadId: string | null;
    leadUrl: string | null;
    companyINN: string | null;
    companyName: string | null;
    directionAndFunnel: string | null;
    createdAt: string;
    updatedAt: string;
}

// ====ХРАНИЛИЩЕ==============================================

export interface StorageData {
    clients: Client[];
}

// ====CHANGELOG==============================================

export interface ChangelogCache {
    data: ChangelogData;
    version: string;
    timestamp: number;
}

export interface ChangelogVersion {
    version: string;
    date: string;
    changes: string[];
}

export interface ChangelogData {
    versions: ChangelogVersion[];
}

// ====СООБЩЕНИЯ==============================================

export type MessageAction = 'openSidebar' | 'sidebarStateChanged';

export interface RuntimeMessage {
    action: MessageAction;
    [key: string]: unknown;
}