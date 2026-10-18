/**
 * Ключи статусов клиента.
 * Формат: cold_* — подтипы "холодного" статуса.
 */
export type ClientStatus =
    | 'unclear'             // ❓ На уточнении
    | 'new'                 // 🆕 Новый
    | 'hot'                 // 🔥 Горячий
    | 'warm'                // 🤔 Тёплый
    | 'active'              // ⭐️ Действующий
    | 'renewal'             // 🔄 Продление
    | 'cold_competitor'     // ⚔️ Холодный: Конкурент
    | 'cold_refusal_demo'   // 📉 Холодный: Отказ после демо
    | 'cold_refusal_start'  // 🥶 Холодный: Отказ на старте
    | 'cold_price'          // 💰 Холодный: Дорого
    | 'cold_later'          // 🕐 Холодный: Не сейчас
    | 'dead'                // 💀 Мёртвый
    | 'not_target'          // 🚫 Нецелевой
    | 'wild';               // 🍒 Wild (специальный, не сохраняется в БД)

export type StatusGroup =
    | 'neutral'   // ❓ На уточнении
    | 'active'    // 🆕🔥🤔 — активные
    | 'current'   // ⭐️🔄 — действующие
    | 'cold'      // ⚔️📉🥶💰🕐 — холодные
    | 'archive'   // 💀🚫 — архив
    | 'wild';     // 🍒 — специальная группа

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

export interface StorageData {
    clients: Client[];
}

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
    currentVersion: string;
    features: string[];
    versions: ChangelogVersion[];
}

export type MessageAction = 'openSidebar' | 'sidebarStateChanged';

export interface RuntimeMessage {
    action: MessageAction;
    [key: string]: unknown;
}