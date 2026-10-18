import type { Client, ClientStatus } from './types';
import { STORAGE_KEYS } from './constants';
import { STATUS_CONFIG } from './statuses';

// ====CLIENT FACTORY==========================================

/**
 * Создаёт нового клиента с автоматически сгенерированным id.
 */
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

/**
 * Сервис для работы с chrome.storage.local.
 * Единая точка доступа к данным клиентов.
 */
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

    /**
     * Сохраняет клиента (upsert по leadId).
     * Если клиент с таким leadId уже есть — обновляет.
     * Если нет — создаёт нового.
     *
     * Без leadId сохранять нельзя — вернёт null и лог в консоль.
     */
    async saveClient(client: Client): Promise<Client | null> {
        if (!client.leadId) {
            console.error(
                `[StorageService] saveClient: отсутствует leadId для "${client.name}"`
            );
            return null;
        }

        const clients = await this.getAllClients();
        const index = clients.findIndex((c) => c.leadId === client.leadId);

        const updatedClient: Client = {
            ...client,
            updatedAt: new Date().toISOString()
        };

        if (index !== -1) {
            // Сохраняем createdAt от старой записи
            updatedClient.createdAt = clients[index].createdAt;
            updatedClient.id = clients[index].id;
            clients[index] = updatedClient;
        } else {
            clients.push(updatedClient);
        }

        await this.saveAllClients(clients);
        return updatedClient;
    }

    /**
     * Перезаписывает весь массив клиентов.
     * Используется для импорта.
     */
    async saveAllClients(clients: Client[]): Promise<void> {
        await this.storage.set({ [STORAGE_KEYS.clients]: clients });
    }

    /**
     * Массовое добавление или обновление клиентов.
     * - Если клиента нет — создаёт нового.
     * - Если есть — обновляет метаданные (name, companyName, directionAndFunnel, companyINN),
     *   но НЕ трогает status, id, createdAt и leadUrl.
     */
    async saveNewClients(newClients: Client[]): Promise<number> {
        const existingClients = await this.getAllClients();
        const clientsByLeadId = new Map(
            existingClients
                .filter((c) => c.leadId)
                .map((c) => [c.leadId as string, c])
        );

        const seenInBatch = new Set<string>();
        let addedCount = 0;
        let updatedCount = 0;

        for (const incoming of newClients) {
            if (!incoming.leadId) {
                console.error(
                    `[StorageService] saveNewClients: пропущен "${incoming.name}" — нет leadId`
                );
                continue;
            }

            if (seenInBatch.has(incoming.leadId)) continue;
            seenInBatch.add(incoming.leadId);

            const existing = clientsByLeadId.get(incoming.leadId);

            if (existing) {
                // Обновляем только метаданные, не трогая status, id, createdAt и leadUrl
                existing.name = incoming.name || existing.name;
                existing.companyName = incoming.companyName || existing.companyName;
                existing.directionAndFunnel = incoming.directionAndFunnel || existing.directionAndFunnel;
                existing.companyINN = incoming.companyINN || existing.companyINN;
                existing.updatedAt = new Date().toISOString();
                updatedCount++;
            } else {
                // Добавляем нового
                existingClients.push(incoming);
                clientsByLeadId.set(incoming.leadId, incoming);
                addedCount++;
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            await this.saveAllClients(existingClients);
            console.log(`[StorageService] Добавлено: ${addedCount}, Обновлено метаданных: ${updatedCount}`);
        }

        return addedCount;
    }

    /**
     * Частичное обновление клиента по id.
     */
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

    // ====УДАЛЕНИЕ============================================

    /**
     * Удаляет клиента по-внутреннему id.
     * Возвращает true если клиент был найден и удалён.
     */
    async deleteClient(id: string): Promise<boolean> {
        const clients = await this.getAllClients();
        const filtered = clients.filter((c) => c.id !== id);

        if (filtered.length === clients.length) {
            return false;
        }

        await this.saveAllClients(filtered);
        return true;
    }

    async deleteClientByLeadId(leadId: string): Promise<boolean> {
        const clients = await this.getAllClients();
        const filtered = clients.filter((c) => c.leadId !== leadId);

        if (filtered.length === clients.length) {
            return false;
        }

        await this.saveAllClients(filtered);
        return true;
    }

    /**
     * Полная очистка хранилища клиентов.
     */
    async clearAll(): Promise<void> {
        await this.saveAllClients([]);
    }

    // ====СТАТИСТИКА==========================================

    /**
     * Возвращает количество клиентов по каждому статусу.
     * Для wild не считаем — он не хранится.
     */
    async getStatusCounts(): Promise<Record<ClientStatus, number>> {
        const clients = await this.getAllClients();
        const counts = {} as Record<ClientStatus, number>;

        for (const status of Object.keys(STATUS_CONFIG) as ClientStatus[]) {
            counts[status] = clients.filter((c) => c.status === status).length;
        }

        return counts;
    }
}