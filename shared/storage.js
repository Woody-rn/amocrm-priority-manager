// ============ Модель клиента ============
export class Client {
    constructor(name, status = 'blue', leadId = null) {
        this.name = name;
        this.status = status;
        this.leadId = leadId;
        this.updatedAt = new Date().toISOString();
    }

    toJSON() {
        return {
            name: this.name,
            status: this.status,
            leadId: this.leadId,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        const client = new Client(data.name, data.status, data.leadId || null);
        client.updatedAt = data.updatedAt;
        return client;
    }
}

// ============ Сервис хранилища ============
export class StorageService {
    constructor() {
        this.storage = chrome.storage.local;
        this.KEY = 'clients';
    }

    async getAllClients() {
        return new Promise((resolve) => {
            this.storage.get(this.KEY, (result) => {
                const clients = result[this.KEY] || [];
                resolve(clients.map(c => Client.fromJSON(c)));
            });
        });
    }

    async getClient(name) {
        const clients = await this.getAllClients();
        return clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    }

    async saveClient(client) {
        const clients = await this.getAllClients();
        const index = clients.findIndex(c => 
            c.name.toLowerCase() === client.name.toLowerCase()
        );
        
        if (index !== -1) {
            clients[index] = client;
        } else {
            clients.push(client);
        }

        await this.saveAllClients(clients);
    }

    async saveAllClients(clients) {
        return new Promise((resolve) => {
            this.storage.set({ [this.KEY]: clients.map(c => c.toJSON()) }, resolve);
        });
    }

    async saveNewClients(newClients) {
        const existingClients = await this.getAllClients();
        const existingNames = new Set(
            existingClients.map(c => c.name.toLowerCase())
        );
        
        const toAdd = newClients.filter(client => 
            !existingNames.has(client.name.toLowerCase())
        );
        
        if (toAdd.length > 0) {
            const allClients = [...existingClients, ...toAdd];
            await this.saveAllClients(allClients);
            return toAdd.length;
        }
        
        return 0;
    }

    async deleteClient(clientName) {
        const clients = await this.getAllClients();
        const filtered = clients.filter(c => c.name !== clientName);
        await this.saveAllClients(filtered);
        return filtered.length;
    }
}