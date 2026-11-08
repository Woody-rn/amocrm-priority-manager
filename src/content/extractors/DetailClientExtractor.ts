import type { Client } from '../../shared/types';
import type { IClientExtractor } from './IClientExtractor';
import { SELECTORS } from '../../shared/constants';
import { createClient } from '../../shared/storage';
import { extractNameFromElement, extractLeadIdFromElement } from '../../shared/utils/parsers';

export class DetailClientExtractor implements IClientExtractor {
    findElements(): HTMLElement[] {
        return Array.from(document.querySelectorAll(SELECTORS.leadsDetail));
    }

    extractClient(element: HTMLElement): Client | null {
        const name = extractNameFromElement(element);
        if (!name) return null;

        const leadId = extractLeadIdFromElement(element);
        const leadUrl = leadId ? `/leads/detail/${leadId}` : null;

        const parserCompanyName = this.extractParserCompanyName(name);
        const originalCompanyName = this.extractOriginalCompanyName();
        const originalCompanyINN = this.extractINN();
        const companyUrl = this.extractCompanyUrl();

        return createClient({
            name,
            status: 'new',
            leadId,
            leadUrl,
            parserCompanyName,
            originalCompanyName,
            originalCompanyINN,
            companyUrl,                        // <-- новое
            directionAndFunnel: null,
            // ====ИИ-ПОЛЯ (пустые при создании)====
            description: null,
            aiRecommendedStatus: null,
            aiScore: null,
            aiLastAnalyzedAt: null
        });
    }

    private extractParserCompanyName(fullName: string): string {
        return fullName
            .replace(/\s*-\s*(nanoCAD|нанокад|норма|Norma|NormaCS|техэкспорт).*$/i, '')
            .trim();
    }

    private extractOriginalCompanyName(): string | null {
        const companyLink = document.querySelector('.card-fields__company a, .card-fields-company a');
        return companyLink?.textContent?.trim() || null;
    }

    private extractCompanyUrl(): string | null {
        const companyLink = document.querySelector('.card-fields__company a, .card-fields-company a') as HTMLAnchorElement | null;
        return companyLink?.getAttribute('href') || null;
    }

    private extractINN(): string | null {
        const input = document.querySelector('input[name="CFV[1699317]"]') as HTMLInputElement | null;
        return input?.value?.trim() || null;
    }
}