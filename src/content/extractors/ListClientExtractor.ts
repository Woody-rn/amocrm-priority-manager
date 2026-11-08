import type { Client } from '../../shared/types';
import type { IClientExtractor } from './IClientExtractor';
import { SELECTORS } from '../../shared/constants';
import { createClient } from '../../shared/storage';
import { extractNameFromElement, extractLeadIdFromElement } from '../../shared/utils/parsers';

export class ListClientExtractor implements IClientExtractor {
    constructor(private pageType: 'todo' | 'leadsList') {}

    findElements(): HTMLElement[] {
        const selector = SELECTORS[this.pageType];
        return Array.from(document.querySelectorAll(selector));
    }

    extractClient(element: HTMLElement): Client | null {
        const name = extractNameFromElement(element);
        if (!name) return null;

        const leadId = extractLeadIdFromElement(element);
        const leadUrl = leadId ? `/leads/detail/${leadId}` : null;
        const parserCompanyName = this.extractCompanyName(name);

        const directionAndFunnel = this.pageType === 'todo'
            ? this.extractDirectionAndFunnel(element)
            : null;

        return createClient({
            name,
            status: 'new',
            leadId,
            leadUrl,
            parserCompanyName,
            originalCompanyName: null,
            originalCompanyINN: null,
            companyUrl: null,                  // <-- новое
            directionAndFunnel,
            // ====ИИ-ПОЛЯ (пустые при создании)====
            description: null,
            aiRecommendedStatus: null,
            aiScore: null,
            aiLastAnalyzedAt: null
        });
    }

    private extractCompanyName(fullName: string): string {
        return fullName
            .replace(/\s*-\s*(nanoCAD|нанокад|норма|Norma|NormaCS|техэксперт).*$/i, '')
            .trim();
    }

    private extractDirectionAndFunnel(element: HTMLElement): string | null {
        if (this.pageType !== 'todo') return null;
        const row = element.closest('.list-row');
        if (!row) return null;
        const el = row.querySelector('.node-lead__pipe-text');
        return el?.textContent?.trim() || null;
    }
}