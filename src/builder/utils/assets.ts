import { nanoid } from './nanoid';

export interface AssetItem {
  id: string;
  name: string;
  url: string;
}

const STORAGE_KEY = 'asset-library';
export const ASSET_EVENT = 'sitebuilder-assets-updated';

function emitAssetUpdate(): void {
  window.dispatchEvent(new CustomEvent(ASSET_EVENT));
}

function writeAssetsToStorage(assets: AssetItem[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    return true;
  } catch (error) {
    console.warn('Failed to persist asset library', error);
    return false;
  }
}

export function loadAssets(): AssetItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAssets(assets: AssetItem[]): void {
  if (!writeAssetsToStorage(assets)) return;
  emitAssetUpdate();
}

export function addAsset(name: string, url: string): AssetItem | null {
  const asset: AssetItem = {
    id: nanoid(),
    name,
    url,
  };

  const next = [asset, ...loadAssets()].slice(0, 60);
  if (!writeAssetsToStorage(next)) return null;
  emitAssetUpdate();
  return asset;
}

export function removeAsset(assetId: string): boolean {
  const next = loadAssets().filter((asset) => asset.id !== assetId);
  const previousLength = loadAssets().length;
  if (next.length === previousLength) return false;
  saveAssets(next);
  return true;
}

export function moveAsset(assetId: string, direction: 'up' | 'down'): boolean {
  const current = loadAssets();
  const index = current.findIndex((asset) => asset.id === assetId);
  if (index < 0) return false;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= current.length) return false;

  const next = [...current];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  saveAssets(next);
  return true;
}
