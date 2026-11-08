import { extractLeadIdFromElement } from '../../shared/utils/parsers';

export interface EnrichmentData {
    leadId: string;
    originalCompanyName: string | null;
    originalCompanyINN: string | null;
    companyUrl: string | null;            // <-- новое
}

export class EnrichmentExtractor {
    findElements(): HTMLElement[] {
        return Array.from(document.querySelectorAll('a.js-navigate-link[href*="/leads/detail/"]'));
    }

    extractData(element: HTMLElement): EnrichmentData | null {
        const leadId = extractLeadIdFromElement(element);
        if (!leadId) return null;

        const row = element.closest('.list-row');
        if (!row) return null;

        // Компания (ссылка + название)
        const companyLink = row.querySelector('.list-row__cell[data-field-code="company_name"] a') as HTMLAnchorElement | null;
        const originalCompanyName = companyLink?.getAttribute('title')?.trim() || companyLink?.textContent?.trim() || null;
        const companyUrl = companyLink?.getAttribute('href') || null;

        // ИНН
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