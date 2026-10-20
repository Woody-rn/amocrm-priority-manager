import type { Client } from '../../shared/types';
import type { IClientExtractor } from './IClientExtractor';
import { SELECTORS } from '../../shared/constants';
import { createClient } from '../../shared/storage';
import { extractNameFromElement, extractLeadIdFromElement } from '../../shared/utils/parsers';

/**
 * Экстрактор для страниц со списком сделок (/todo, /leads/list).
 */
export class ListClientExtractor implements IClientExtractor {
    constructor(private pageType: 'todo' | 'leadsList') {}

    findElements(): HTMLElement[] {
        const selector = SELECTORS[this.pageType];
        return Array.from(document.querySelectorAll(selector));
    }

    extractClient(element: HTMLElement): Client | null {
        const name = extractNameFromElement(element);
        if (!name) {
            console.warn('[ListExtractor] Пропущен элемент без названия');
            return null;
        }

        const leadId = extractLeadIdFromElement(element);
        const leadUrl = leadId ? `/leads/detail/${leadId}` : null;
        const companyName = this.extractCompanyName(name);

        // На /todo есть воронка, на /leads/list - нет
        const directionAndFunnel = this.pageType === 'todo'
            ? this.extractDirectionAndFunnel(element)
            : null;

        return createClient({
            name,
            status: 'new',
            leadId,
            leadUrl,
            companyINN: null, // На этих страницах ИНН нет
            companyName,
            directionAndFunnel
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