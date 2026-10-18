import type { Client } from '../types';

// ====CLIENT INDEXES=========================================

export interface ClientIndexes {
    byLeadId: Map<string, Client>;
    byName: Map<string, Client>;
}

/**
 * Строит индексы клиентов для быстрого поиска.
 *
 * Возвращает:
 * - byLeadId — для поиска по ID сделки (основной)
 * - byName — для поиска по названию (fallback)
 */
export function buildClientIndexes(clients: Client[]): ClientIndexes {
    const byLeadId = new Map<string, Client>();
    const byName = new Map<string, Client>();

    for (const client of clients) {
        if (client.leadId) {
            byLeadId.set(client.leadId, client);
        }
        byName.set(client.name, client);
    }

    return { byLeadId, byName };
}