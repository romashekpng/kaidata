// White KAI wordmark on a transparent background.
const kaiLogo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 830 154"><path fill="white" fill-rule="evenodd" d="M88 0H216L187 50 249 0H390L283 77 303 144 456 0H632L618 154H477L482 136H447L430 154H174L156 106 128 154H0ZM482 87H506L518 44ZM707 0H830L742 154H619Z"/></svg>';
export const DEFAULT_SIDEBAR_LOGO = 'data:image/svg+xml,' + encodeURIComponent(kaiLogo);
// Keep the image small enough for a single Excel settings cell as well as JSON.
export const MAX_SIDEBAR_LOGO_LENGTH = 32000;
export function validateSidebarLogo(value) {
 if(value===''||value===DEFAULT_SIDEBAR_LOGO)return value;
 if(typeof value!=='string'||value.length>MAX_SIDEBAR_LOGO_LENGTH)throw new Error('Логотип: завантажте зображення через налаштування університету.');
 const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match)throw new Error('Логотип: потрібне вбудоване зображення PNG, JPEG або WebP.');
 let bytes;try{bytes=atob(match[2]);}catch{throw new Error('Логотип: пошкоджені дані зображення.');}
 const valid=match[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
 if(!valid)throw new Error('Логотип: формат не відповідає вмісту зображення.');
 return value;
}
