import type { Client } from '../types';

// ====CLIENT INDEXES=========================================

export interface ClientIndexes {
    byLeadId: Map<string, Client>;
    byName: Map<string, Client>;
    byCompany: Map<string, Client[]>;
}

/**
 * Строит индексы клиентов для быстрого поиска.
 *
 * Возвращает:
 * - byLeadId — для поиска по ID сделки (основной)
 * - byName — для поиска по названию (fallback)
 * - byCompany — для группировки сделок по одной компании
 */
export function buildClientIndexes(clients: Client[]): ClientIndexes {
    const byLeadId = new Map<string, Client>();
    const byName = new Map<string, Client>();
    const byCompany = new Map<string, Client[]>();

    for (const client of clients) {
        if (client.leadId) {
            byLeadId.set(client.leadId, client);
        }
        byName.set(client.name, client);

        if (client.companyName) {
            const existing = byCompany.get(client.companyName) || [];
            existing.push(client);
            byCompany.set(client.companyName, existing);
        }
    }

    return { byLeadId, byName, byCompany };
}