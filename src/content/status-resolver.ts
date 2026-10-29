import type { Client, ClientStatus } from '../shared/types';
import type { PageType } from '../shared/constants';
import type { ClientIndexes } from '../shared/utils/build-client-indexes';

// ====STATUS RESOLVER=========================================

/**
 * Определяет статус клиента для подсветки.
 *
 * Знает про:
 * - Текущую страницу (PageType)
 * - Индексы клиентов (передаются в конструктор)
 *
 * Не знает про:
 * - DOM
 * - StorageService
 * - Способы рендера
 */
export class StatusResolver {
    constructor(
        private indexes: ClientIndexes,
        private pageType: PageType
    ) {}

    /**
     * Определяет статус для клиента.
     */
    resolve(clientName: string, leadId: string | null): ClientStatus {
        if (leadId) {
            const byLeadId = this.indexes.byLeadId.get(leadId);
            if (byLeadId) return byLeadId.status;
        }

        const byName = this.indexes.byName.get(clientName);
        if (byName) return byName.status;

        return this.pageType === 'todo' ? 'new' : 'wild';
    }

    /**
     * Возвращает объект клиента по leadId или имени.
     */
    getClient(leadId: string | null, clientName: string): Client | null {
        if (leadId) {
            const byLeadId = this.indexes.byLeadId.get(leadId);
            if (byLeadId) return byLeadId;
        }
        return this.indexes.byName.get(clientName) || null;
    }

    /**
     * Возвращает количество других сделок у этой же компании,
     * но с другим продуктом (воронкой).
     */
    getOtherDealsCount(companyName: string | null, currentFunnel: string | null): number {
        if (!companyName) return 0;

        const deals = this.indexes.byCompany.get(companyName);
        if (!deals) return 0;

        const currentProduct = this.extractProduct(currentFunnel);

        return deals.filter(deal => {
            const dealProduct = this.extractProduct(deal.directionAndFunnel);
            return dealProduct !== currentProduct;
        }).length;
    }

    /**
     * Извлекает название продукта из строки воронки (например, "nanoCAD" из "nanoCAD: Продажа").
     * Если воронка пуста, считаем продукт "unknown".
     */
    private extractProduct(funnel: string | null): string {
        if (!funnel) return 'unknown';
        return funnel.split(':')[0].trim().toLowerCase();
    }
}