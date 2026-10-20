import type { Client } from '../../shared/types';

/**
 * Интерфейс для извлечения данных о сделке со страницы.
 * Разные реализации для разных страниц (Список и Детали).
 */
export interface IClientExtractor {
    /**
     * Находит все элементы на странице, которые нужно обработать.
     */
    findElements(): HTMLElement[];

    /**
     * Извлекает данные клиента из конкретного DOM-элемента.
     * Возвращает null, если данных недостаточно.
     */
    extractClient(element: HTMLElement): Client | null;
}