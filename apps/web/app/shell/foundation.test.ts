import { describe, expect, it } from 'vitest';

import { allNavigationItems, findNavigationItem, navigationCatalog } from './catalog';
import { navigationLabel } from './navigation-messages';
import { messages, translate, type Locale } from './messages';

describe('design foundation catalog', () => {
  it('includes the complete 18-section product map', () => {
    expect(navigationCatalog).toHaveLength(18);
    expect(navigationCatalog.every((section) => section.items.length > 0)).toBe(true);
  });

  it('provides a non-empty translation for every section and module in English, French, and Arabic', () => {
    const locales: Locale[] = ['en', 'fr', 'ar'];
    for (const locale of locales) {
      for (const section of navigationCatalog) {
        expect(navigationLabel(locale, section.key)).not.toBe('');
        for (const item of section.items) {
          expect(navigationLabel(locale, item.key)).not.toBe('');
        }
      }
      expect(Object.keys(messages[locale]).sort()).toEqual(Object.keys(messages.en).sort());
    }
  });

  it('marks only existing UI routes as available', () => {
    const available = allNavigationItems.filter((item) => item.available);
    expect(available.map((item) => item.key).sort()).toEqual([
      'currentState',
      'overview',
      'profiles',
      'projects',
    ]);
    expect(new Set(available.map((item) => item.href))).toEqual(new Set(['/', '/app']));
    expect(findNavigationItem('/ml/model-registry')?.available).toBe(false);
    expect(findNavigationItem('/research/evidence')?.available).toBe(false);
  });

  it('uses English as the fallback dictionary and preserves explicit data-state distinctions', () => {
    expect(translate('en', 'noData')).toBe('No data');
    expect(translate('en', 'unknown')).toBe('Unknown');
    expect(translate('en', 'notEvaluable')).toBe('Not evaluable');
    expect(translate('en', 'error')).toBe('Error');
  });
});