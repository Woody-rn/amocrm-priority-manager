import type { Client } from '../shared/types';
import type { PageType } from '../shared/constants';
import { SELECTORS } from '../shared/constants';
import { createClient } from '../shared/storage';
import { extractNameFromElement, extractLeadIdFromElement } from '../shared/utils/parsers';

// ====COLLECTORS=============================================

export class Collector {
    constructor(private pageType: PageType) {}

    findElements(): HTMLElement[] {
        const selector = SELECTORS[this.pageType];
        return Array.from(document.querySelectorAll(selector));
    }

    extractClient(element: HTMLElement): Client | null {
        const name = extractNameFromElement(element);
        if (!name) {
            console.warn('[Collector] Пропущен элемент без названия');
            return null;
        }

        const leadId = extractLeadIdFromElement(element);
        const leadUrl = leadId ? `/leads/detail/${leadId}` : null;
        const companyName = this.extractCompanyName(name);
        const companyINN = this.extractINN(element);
        const directionAndFunnel = this.extractDirectionAndFunnel(element);

        return createClient({
            name,
            status: 'new',
            leadId,
            leadUrl,
            companyINN,
            companyName,
            directionAndFunnel
        });
    }

    // ====EXTRACTORS===========================================

    private extractCompanyName(fullName: string): string {
        return fullName
            .replace(
                /\s*-\s*(nanoCAD|нанокад|норма|Norma|NormaCS|техэксперт).*$/i,
                ''
            )
            .trim();
    }

    private extractINN(element: HTMLElement): string | null {
        if (this.pageType !== 'leadsDetail') return null;

        const input = element.querySelector(
            'input[name="CFV[1699317]"]'
        ) as HTMLInputElement | null;

        return input?.value?.trim() || null;
    }

    private extractDirectionAndFunnel(element: HTMLElement): string | null {
        if (this.pageType !== 'todo') return null;

        const row = element.closest('.list-row');
        if (!row) return null;

        const el = row.querySelector('.node-lead__pipe-text');
        return el?.textContent?.trim() || null;
    }
}