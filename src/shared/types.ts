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
    | 'passive'                  // 🐢 Пассивный интерес
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

    parserCompanyName: string | null;
    originalCompanyName: string | null;
    originalCompanyINN: string | null;
    companyUrl: string | null;
    directionAndFunnel: string | null;

    createdAt: string;
    updatedAt: string;

    // ====ИИ-ПОЛЯ====
    description: string | null;
    aiRecommendedStatus: ClientStatus | null;
    aiScore: number | null;
    aiLastAnalyzedAt: string | null;
}

// ====CHANGELOG==============================================

export interface ChangelogCache {
    data: ChangelogData;
    version: string;
    timestamp: number;
}

export interface ChangelogVersion {
    version: string;
    changes: string[];
}

export interface ChangelogData {
    versions: ChangelogVersion[];
}

// ====ТАБЛИЦА================================================

export interface TableColumn {
    key: keyof Client | 'actions';
    label: string;
    visible: boolean;
    sortable?: boolean;
    formatter?: (client: Client) => string | HTMLElement; // <-- добавили HTMLElement
}

export interface TableSettings {
    visibleColumns: string[]; // массив ключей (keyof Client)
}