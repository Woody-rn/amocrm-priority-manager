// ====PARSERS================================================

/**
 * Парсеры данных из DOM amoCRM.
 * Чистые функции — только преобразование строк.
 */

/**
 * Очистка названия сделки:
 * - убираем +/- в начале
 * - убираем числа в начале (включая 0)
 * - убираем лишние пробелы
 */
export function parseClientName(raw: string): string {
    return raw
        .replace(/^[+-]\s*/, '')
        .replace(/^0?\d+\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Извлечение названия сделки из элемента.
 * Для textarea/input берём value, для ссылок — title или textContent.
 */
export function extractNameFromElement(element: HTMLElement): string {
    let raw: string;

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // Для полей ввода текст лежит в value, а не в textContent
        raw = (element as HTMLTextAreaElement).value || '';
    } else {
        raw = element.getAttribute('title') || element.textContent?.trim() || '';
    }

    return parseClientName(raw);
}

/**
 * Извлечение leadId из href ссылки.
 */
export function parseLeadIdFromHref(href: string | null): string | null {
    if (!href) return null;
    const match = href.match(/\/leads\/detail\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Извлечение leadId из элемента.
 * - Для ссылок: из href
 * - Для textarea (страница /leads/detail): из тега span.tag рядом с названием
 * - Fallback: из URL страницы
 */
export function extractLeadIdFromElement(element: HTMLElement): string | null {
    // 1. Если это ссылка (на /todo, /leads/list)
    const href = element.getAttribute('href');
    if (href) {
        return parseLeadIdFromHref(href);
    }

    // 2. Если это textarea (на /leads/detail)
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // Ищем контейнер вокруг textarea
        const wrapper = element.closest('.card-fields__top-name');

        // Ищем тег с ID, исключая кнопку "Тегировать"
        const tag = wrapper?.querySelector('span.tag[title^="#"]:not([title="#тегировать"])');
        const tagTitle = tag?.getAttribute('title');

        if (tagTitle) {
            const match = tagTitle.match(/#(\d+)/);
            if (match) return match[1];
        }
    }

    // 3. Fallback: из URL страницы
    const match = location.href.match(/\/leads\/detail\/(\d+)/);
    return match ? match[1] : null;
}