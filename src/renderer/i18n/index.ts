import { zh, type I18nDict } from './zh';
import { en } from './en';

export type Language = 'zh' | 'en';

export const dicts: Record<Language, I18nDict> = { zh, en };

export function getDict(lang: Language): I18nDict {
  return dicts[lang] ?? zh;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
