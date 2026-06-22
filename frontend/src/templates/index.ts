export type { Template } from './types';
import { NEW_TEMPLATES } from './new';
import { BUILTIN_TEMPLATES } from './builtin';

export const TEMPLATES = [...NEW_TEMPLATES, ...BUILTIN_TEMPLATES];

/** 默认模板 ID */
export const DEFAULT_TEMPLATE_ID = 'linked_list_reverse';
