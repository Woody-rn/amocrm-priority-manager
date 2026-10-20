import type { Client } from '../../shared/types';
import type { IClientExtractor } from './IClientExtractor';
import { SELECTORS } from '../../shared/constants';
import { createClient } from '../../shared/storage';
import { extractNameFromElement, extractLeadIdFromElement } from '../../shared/utils/parsers';

/**
 * Экстрактор для страницы деталей сделки (/leads/detail).
 */
export class DetailClientExtractor implements IClientExtractor {
    findElements(): HTMLElement[] {
        return Array.from(document.querySelectorAll(SELECTORS.leadsDetail));
    }

    extractClient(element: HTMLElement): Client | null {
        const name = extractNameFromElement(element);
        if (!name) {
            console.warn('[DetailExtractor] Пропущен элемент без названия');
            return null;
        }

        const leadId = extractLeadIdFromElement(element);
        const leadUrl = leadId ? `/leads/detail/${leadId}` : null;
        const companyName = this.extractCompanyName(name);
        const companyINN = this.extractINN();

        return createClient({
            name,
            status: 'new',
            leadId,
            leadUrl,
            companyINN,
            companyName,
            directionAndFunnel: null // Пока не парсим воронку на этой странице
        });
    }

    private extractCompanyName(fullName: string): string {
        return fullName
            .replace(/\s*-\s*(nanoCAD|нанокад|норма|Norma|NormaCS|техэкспорт).*$/i, '')
            .trim();
    }

    private extractINN(): string | null {
        // Пока просто пытаемся найти по известному селектору
        const input = document.querySelector('input[name="CFV[1699317]"]') as HTMLInputElement | null;
        return input?.value?.trim() || null;
    }
}