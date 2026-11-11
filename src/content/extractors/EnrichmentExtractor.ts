import { extractLeadIdFromElement } from '../../shared/utils/parsers';
import { SELECTORS } from '../../shared/constants';

export interface EnrichmentData {
    leadId: string;
    originalCompanyName: string | null;
    originalCompanyINN: string | null;
    companyUrl: string | null;
}

export class EnrichmentExtractor {
    findElements(): HTMLElement[] {
        // Дополнительная проверка: если мы не на странице списка сделок, не ищем элементы
        if (!document.querySelector(SELECTORS.leadsListMarker)) {
            return [];
        }
        return Array.from(document.querySelectorAll('a.js-navigate-link[href*="/leads/detail/"]'));
    }

    extractData(element: HTMLElement): EnrichmentData | null {
        // Защита: обогащаем только на странице списка сделок (все сделки или конкретная воронка)
        if (!document.querySelector(SELECTORS.leadsListMarker)) {
            return null;
        }

        const leadId = extractLeadIdFromElement(element);
        if (!leadId) return null;

        const row = element.closest('.list-row');
        if (!row) return null;

        const companyCell = row.querySelector('.list-row__cell[data-field-code="company_name"]');
        if (!companyCell) return null;

        const companyLink = companyCell.querySelector('a') as HTMLAnchorElement | null;
        const originalCompanyName = companyLink?.getAttribute('title')?.trim() || companyLink?.textContent?.trim() || null;
        const companyUrl = companyLink?.getAttribute('href') || null;

        const innCell = row.querySelector('.list-row__cell[data-field-code="cf1699317"] .content-table__item__inner');
        const originalCompanyINN = innCell?.getAttribute('title')?.trim() || innCell?.textContent?.trim() || null;

        return {
            leadId,
            originalCompanyName,
            originalCompanyINN,
            companyUrl
        };
    }
}