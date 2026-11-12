import type { Client, ClientStatus } from './types';
import { STORAGE_KEYS } from './constants';
import { STATUS_CONFIG } from './statuses';
import type { EnrichmentData } from '../content/extractors/EnrichmentExtractor';

// ====CLIENT FACTORY==========================================

export function createClient(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client {
    const now = new Date().toISOString();
    return {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
    };
}

// ====STORAGE SERVICE=========================================

export class StorageService {
    private storage = chrome.storage.local;

    // ====ЧТЕНИЕ==============================================

    async getAllClients(): Promise<Client[]> {
        const result = await this.storage.get(STORAGE_KEYS.clients);
        return (result[STORAGE_KEYS.clients] as Client[]) ?? [];
    }

    async getClientById(id: string): Promise<Client | null> {
        const clients = await this.getAllClients();
        return clients.find((c) => c.id === id) ?? null;
    }

    async getClientByLeadId(leadId: string): Promise<Client | null> {
        const clients = await this.getAllClients();
        return clients.find((c) => c.leadId === leadId) ?? null;
    }

    async getClientByName(name: string): Promise<Client | null> {
        const clients = await this.getAllClients();
        return clients.find((c) => c.name === name) ?? null;
    }

    // ====ЗАПИСЬ==============================================

    async saveClient(client: Client): Promise<Client | null> {
        if (!client.leadId) {
            console.error(`[StorageService] saveClient: отсутствует leadId для "${client.name}"`);
            return null;
        }

        const clients = await this.getAllClients();
        const index = clients.findIndex((c) => c.leadId === client.leadId);

        const updatedClient: Client = {
            ...client,
            updatedAt: new Date().toISOString()
        };

        if (index !== -1) {
            updatedClient.createdAt = clients[index].createdAt;
            updatedClient.id = clients[index].id;
            clients[index] = updatedClient;
        } else {
            clients.push(updatedClient);
        }

        await this.saveAllClients(clients);
        return updatedClient;
    }

    async saveAllClients(clients: Client[]): Promise<void> {
        await this.storage.set({ [STORAGE_KEYS.clients]: clients });
    }

    async saveNewClients(newClients: Client[]): Promise<number> {
        const existingClients = await this.getAllClients();
        const clientsByLeadId = new Map(existingClients.filter((c) => c.leadId).map((c) => [c.leadId as string, c]));
        const seenInBatch = new Set<string>();
        let addedCount = 0;
        let updatedCount = 0;

        for (const incoming of newClients) {
            if (!incoming.leadId) continue;
            if (seenInBatch.has(incoming.leadId)) continue;
            seenInBatch.add(incoming.leadId);

            const existing = clientsByLeadId.get(incoming.leadId);

            if (existing) {
                const hasChanges =
                    (incoming.name && incoming.name !== existing.name) ||
                    (incoming.parserCompanyName && incoming.parserCompanyName !== existing.parserCompanyName) ||
                    (incoming.originalCompanyName && incoming.originalCompanyName !== existing.originalCompanyName) ||
                    (incoming.originalCompanyINN && incoming.originalCompanyINN !== existing.originalCompanyINN) ||
                    (incoming.companyUrl && incoming.companyUrl !== existing.companyUrl) ||
                    (incoming.directionAndFunnel && incoming.directionAndFunnel !== existing.directionAndFunnel);

                if (hasChanges) {
                    existing.name = incoming.name || existing.name;
                    existing.parserCompanyName = incoming.parserCompanyName || existing.parserCompanyName;
                    existing.originalCompanyName = incoming.originalCompanyName || existing.originalCompanyName;
                    existing.originalCompanyINN = incoming.originalCompanyINN || existing.originalCompanyINN;
                    existing.companyUrl = incoming.companyUrl || existing.companyUrl;
                    existing.directionAndFunnel = incoming.directionAndFunnel || existing.directionAndFunnel;
                    existing.updatedAt = new Date().toISOString();
                    updatedCount++;
                }
            } else {
                existingClients.push(incoming);
                clientsByLeadId.set(incoming.leadId, incoming);
                addedCount++;
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            await this.saveAllClients(existingClients);
            console.log(`[StorageService] Добавлено: ${addedCount}, Обновлено: ${updatedCount}`);
        }
        return addedCount;
    }

    async updateClient(id: string, patch: Partial<Client>): Promise<Client | null> {
        const clients = await this.getAllClients();
        const index = clients.findIndex((c) => c.id === id);

        if (index === -1) {
            console.error(`[StorageService] updateClient: клиент с id="${id}" не найден`);
            return null;
        }

        const updated: Client = {
            ...clients[index],
            ...patch,
            id: clients[index].id,
            updatedAt: new Date().toISOString()
        };

        clients[index] = updated;
        await this.saveAllClients(clients);
        return updated;
    }

    async updateAiFields(updates: Array<{
        leadId: string;
        description: string | null;
        aiRecommendedStatus: ClientStatus | null;
        aiScore: number | null;
        aiLastAnalyzedAt: string | null;
    }>): Promise<number> {
        const clients = await this.getAllClients();
        const clientsByLeadId = new Map(clients.filter((c) => c.leadId).map((c) => [c.leadId as string, c]));
        let updated = 0;

        for (const update of updates) {
            const client = clientsByLeadId.get(update.leadId);
            if (!client) continue;

            client.description = update.description;
            client.aiRecommendedStatus = update.aiRecommendedStatus;
            client.aiScore = update.aiScore;
            client.aiLastAnalyzedAt = update.aiLastAnalyzedAt;
            client.updatedAt = new Date().toISOString();
            updated++;
        }

        if (updated > 0) {
            await this.saveAllClients(clients);
            console.log(`[StorageService] ИИ-поля обновлены у ${updated} записей`);
        }
        return updated;
    }

    async enrichClients(data: EnrichmentData[]): Promise<number> {
        const existingClients = await this.getAllClients();
        const clientsByLeadId = new Map(existingClients.filter((c) => c.leadId).map((c) => [c.leadId as string, c]));
        let enrichedCount = 0;

        for (const item of data) {
            const existing = clientsByLeadId.get(item.leadId);
            if (!existing) continue;

            let hasChanges = false;
            if (item.originalCompanyName && item.originalCompanyName !== existing.originalCompanyName) {
                existing.originalCompanyName = item.originalCompanyName;
                hasChanges = true;
            }
            if (item.originalCompanyINN && item.originalCompanyINN !== existing.originalCompanyINN) {
                existing.originalCompanyINN = item.originalCompanyINN;
                hasChanges = true;
            }
            if (item.companyUrl && item.companyUrl !== existing.companyUrl) {
                existing.companyUrl = item.companyUrl;
                hasChanges = true;
            }
            if (hasChanges) {
                existing.updatedAt = new Date().toISOString();
                enrichedCount++;
            }
        }

        if (enrichedCount > 0) {
            await this.saveAllClients(existingClients);
            console.log(`[StorageService] Обогащено: ${enrichedCount} записей`);
        }
        return enrichedCount;
    }

    async clearAiData(): Promise<number> {
        const clients = await this.getAllClients();
        let count = 0;

        for (const client of clients) {
            if (client.aiRecommendedStatus || client.aiScore || client.description || client.aiLastAnalyzedAt) {
                client.aiRecommendedStatus = null;
                client.aiScore = null;
                client.description = null;
                client.aiLastAnalyzedAt = null;
                count++;
            }
        }

        if (count > 0) {
            await this.saveAllClients(clients);
            console.log(`[StorageService] Очищены ИИ-данные у ${count} записей`);
        }
        return count;
    }

    // ====УДАЛЕНИЕ============================================

    async deleteClient(id: string): Promise<boolean> {
        const clients = await this.getAllClients();
        const filtered = clients.filter((c) => c.id !== id);
        if (filtered.length === clients.length) return false;
        await this.saveAllClients(filtered);
        return true;
    }

    async deleteClientByLeadId(leadId: string): Promise<boolean> {
        const clients = await this.getAllClients();
        const filtered = clients.filter((c) => c.leadId !== leadId);
        if (filtered.length === clients.length) return false;
        await this.saveAllClients(filtered);
        return true;
    }

    async clearAll(): Promise<void> {
        await this.saveAllClients([]);
    }

    // ====СТАТИСТИКА==========================================

    async getStatusCounts(): Promise<Record<ClientStatus, number>> {
        const clients = await this.getAllClients();
        const counts = {} as Record<ClientStatus, number>;

        for (const status of Object.keys(STATUS_CONFIG) as ClientStatus[]) {
            counts[status] = clients.filter((c) => c.status === status).length;
        }

        return counts;
    }
}