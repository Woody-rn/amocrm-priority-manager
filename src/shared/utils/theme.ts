import { SettingsService } from '../settings';

/**
 * Применяет выбранную тему к текущей странице.
 */
export async function applyTheme(): Promise<void> {
    const settingsService = new SettingsService();
    const settings = await settingsService.getSettings();

    let theme = settings.theme;

    // Если выбрана "системная", проверяем настройки ОС
    if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = isDark ? 'dark' : 'light';
    }

    // Удаляем старые классы и ставим новый
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);
}