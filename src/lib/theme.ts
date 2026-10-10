export const THEME_STORAGE_KEY = "viva-tema";

/**
 * Script que roda antes da primeira pintura da página: aplica o tema salvo
 * (ou o do sistema) para a tela não "piscar" de claro para escuro.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="claro"&&t!=="escuro"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro"}document.documentElement.dataset.theme=t==="escuro"?"dark":"light"}catch(e){}})();`;
