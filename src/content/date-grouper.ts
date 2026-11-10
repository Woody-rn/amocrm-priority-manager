// ====DATE GROUPER===========================================

/**
 * Группирует строки задач по датам на странице /todo.
 * Просто навешивает классы на строки, не добавляя новых элементов в DOM.
 */
export function groupListRowsByDate(): void {
    const rows = Array.from(document.querySelectorAll('.js-list-row')) as HTMLElement[];

    // Если строк нет, сбрасываем всё и выходим
    if (rows.length === 0) {
        document.querySelectorAll('.custom-date-separator').forEach(el => el.classList.remove('custom-date-separator'));
        return;
    }

    let prevDate = '';

    rows.forEach((row, index) => {
        // На всякий случай снимаем класс со всех строк
        row.classList.remove('custom-date-separator');

        // Ищем ячейку с датой
        const dateCell = row.querySelector('.list-row__cell-template-task_date .block-selectable');
        if (!dateCell) return;

        const rawText = dateCell.textContent?.trim() || '';
        const date = rawText ? rawText.split(' ')[0] : '';

        // Если дата изменилась (и это не самая первая строка)
        if (date && date !== prevDate) {
            if (index > 0) {
                row.classList.add('custom-date-separator');
            }
            prevDate = date;
        }
    });
}