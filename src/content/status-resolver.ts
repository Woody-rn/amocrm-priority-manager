import type { ClientStatus } from '../shared/types';
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
     *
     * Логика:
     * 1. Ищем в БД по leadId
     * 2. Если нет — по name
     * 3. Если нет в БД:
     *    - на /todo → 'new' (автосбор добавит)
     *    - на других страницах → 'wild'
     */
    resolve(clientName: string, leadId: string | null): ClientStatus {
        // 1. Ищем по leadId
        if (leadId) {
            const byLeadId = this.indexes.byLeadId.get(leadId);
            if (byLeadId) return byLeadId.status;
        }

        // 2. Ищем по name
        const byName = this.indexes.byName.get(clientName);
        if (byName) return byName.status;

        // 3. Нет в БД
        return this.pageType === 'todo' ? 'new' : 'wild';
    }
}