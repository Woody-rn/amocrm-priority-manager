import { extractLeadIdFromElement } from '../../shared/utils/parsers';

export interface EnrichmentData {
    leadId: string;
    originalCompanyName: string | null;
    originalCompanyINN: string | null;
}

export class EnrichmentExtractor {
    findElements(): HTMLElement[] {
        // Ищем все ссылки на сделки в списке
        return Array.from(document.querySelectorAll('a.js-navigate-link[href*="/leads/detail/"]'));
    }

    extractData(element: HTMLElement): EnrichmentData | null {
        const leadId = extractLeadIdFromElement(element);
        if (!leadId) return null;

        // Поднимаемся до строки (list-row)
        const row = element.closest('.list-row');
        if (!row) return null;

        // 1. Компания (ячейка с data-field-code="company_name")
        const companyCell = row.querySelector('.list-row__cell[data-field-code="company_name"] a');
        const originalCompanyName = companyCell?.getAttribute('title')?.trim() || companyCell?.textContent?.trim() || null;

        // 2. ИНН (ячейка с data-field-code="cf1699317")
        const innCell = row.querySelector('.list-row__cell[data-field-code="cf1699317"] .content-table__item__inner');
        const originalCompanyINN = innCell?.getAttribute('title')?.trim() || innCell?.textContent?.trim() || null;

        return {
            leadId,
            originalCompanyName,
            originalCompanyINN
        };
    }
}