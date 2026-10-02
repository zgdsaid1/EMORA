import { notFound } from 'next/navigation';

import { findNavigationItem, navigationCatalog } from '../shell/catalog';
import { ModulePlaceholder } from '../shell/module-placeholder';

export default async function PlannedModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const item = findNavigationItem(`/${slug.join('/')}`);
  if (!item || item.available) notFound();
  const section = navigationCatalog.find((entry) => entry.items.includes(item));
  if (!section) notFound();
  return <ModulePlaceholder itemKey={item.key} sectionKey={section.key} />;
}