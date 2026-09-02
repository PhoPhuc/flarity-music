export const CURRENT_APP_VERSION = '1.1.7';
export const GITHUB_REPO_OWNER = 'PhoPhuc';
export const GITHUB_REPO_NAME = 'flarity-music';
export const GITHUB_API_LATEST_RELEASE = 'https://api.github.com/repos/' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '/releases/latest';
export const GITHUB_RELEASES_PAGE = 'https://github.com/' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '/releases';

export interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
  type: 'exe' | 'zip' | 'msi' | 'dmg' | 'other';
}

export interface AppUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTitle: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  recommendedAsset?: ReleaseAsset;
  allAssets: ReleaseAsset[];
}

/**
 * So sánh 2 chuỗi phiên bản dạng semver (ví dụ '1.1.3' vs '1.1.2')
 * Trả về 1 nếu v1 > v2, -1 nếu v1 < v2, 0 nếu bằng nhau.
 */
export const compareVersions = (v1: string, v2: string): number => {
  const clean1 = v1.replace(/^v/i, '').split('-')[0];
  const clean2 = v2.replace(/^v/i, '').split('-')[0];

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

/**
 * Nhận diện hệ điều hành người dùng để đề xuất đúng file cài đặt
 */
import { isTauriAvailable, tauriAPI } from '../utils/tauriBridge';

export const detectPlatform = (): 'windows' | 'macos' | 'linux' | 'unknown' => {
  if (typeof window === 'undefined') return 'unknown';
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = (window.navigator as any)?.userAgentData?.platform?.toLowerCase() || window.navigator.platform?.toLowerCase() || '';

  if (ua.includes('mac') || platform.includes('mac')) return 'macos';
  if (ua.includes('win') || platform.includes('win')) return 'windows';
  if (ua.includes('linux') || platform.includes('linux')) return 'linux';
  return 'unknown';
};

/**
 * Mở đường dẫn trên trình duyệt mặc định của hệ điều hành
 */
export const openExternalLink = async (url: string): Promise<boolean> => {
  if (!url) return false;
  try {
    if (isTauriAvailable()) {
      const res = await tauriAPI.openExternalUrl(url);
      if (res) return true;
    }
  } catch (err) {
    console.warn('[UpdateService] Tauri openExternalUrl failed, trying fallback:', err);
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch (err) {
    console.warn('[UpdateService] Failed to open url via window.open:', url, err);
    return false;
  }
};

/**
 * Kiểm tra phiên bản mới từ GitHub Releases
 */
export const checkForAppUpdate = async (options: { force?: boolean } = {}): Promise<AppUpdateInfo> => {
  const defaultResult: AppUpdateInfo = {
    hasUpdate: false,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION,
    releaseTitle: '',
    releaseNotes: '',
    publishedAt: '',
    releaseUrl: GITHUB_RELEASES_PAGE,
    allAssets: [],
  };

  try {
    const res = await fetch(GITHUB_API_LATEST_RELEASE, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-cache',
    });

    if (!res.ok) {
      console.warn('[UpdateService] GitHub API responded with status ' + res.status);
      return defaultResult;
    }

    const data = await res.json();
    const rawTag = (data.tag_name || '').trim();
    const latestVersion = rawTag.replace(/^v/i, '');

    if (!latestVersion) {
      return defaultResult;
    }

    // Kiểm tra xem có phiên bản mới hơn phiên bản hiện tại không
    const isNewer = compareVersions(latestVersion, CURRENT_APP_VERSION) > 0;

    // Kiểm tra nếu người dùng đã bấm 'Bỏ qua phiên bản này'
    if (isNewer && !options.force) {
      const skippedVersion = localStorage.getItem('flarity_skipped_update_version');
      if (skippedVersion === latestVersion) {
        return {
          ...defaultResult,
          hasUpdate: false,
          latestVersion,
        };
      }
    }

    // Phân loại các assets
    const platform = detectPlatform();
    const allAssets: ReleaseAsset[] = (data.assets || []).map((asset: any) => {
      const name = asset.name || '';
      let type: ReleaseAsset['type'] = 'other';
      if (name.endsWith('.exe')) type = 'exe';
      else if (name.endsWith('.dmg')) type = 'dmg';
      else if (name.endsWith('.msi')) type = 'msi';
      else if (name.endsWith('.zip')) type = 'zip';

      return {
        name,
        size: asset.size || 0,
        downloadUrl: asset.browser_download_url || '',
        type,
      };
    });

    // Tìm asset phù hợp nhất với OS
    let recommendedAsset: ReleaseAsset | undefined;
    if (platform === 'windows') {
      recommendedAsset =
        allAssets.find((a) => a.name.toLowerCase().includes('setup.exe')) ||
        allAssets.find((a) => a.type === 'exe') ||
        allAssets.find((a) => a.type === 'zip');
    } else if (platform === 'macos') {
      recommendedAsset = allAssets.find((a) => a.type === 'dmg');
    }

    localStorage.setItem('flarity_last_update_check_time', Date.now().toString());

    return {
      hasUpdate: isNewer,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      releaseTitle: data.name || ('Flarity Music v' + latestVersion),
      releaseNotes: data.body || '',
      publishedAt: data.published_at || '',
      releaseUrl: data.html_url || GITHUB_RELEASES_PAGE,
      recommendedAsset,
      allAssets,
    };
  } catch (error) {
    console.warn('[UpdateService] Failed to check for update:', error);
    return defaultResult;
  }
};

/**
 * Đánh dấu bỏ qua phiên bản này không nhắc lại
 */
export const skipThisUpdateVersion = (version: string) => {
  localStorage.setItem('flarity_skipped_update_version', version);
};

/**
 * Xóa đánh dấu bỏ qua để nhận thông báo lại
 */
export const resetSkippedUpdateVersion = () => {
  localStorage.removeItem('flarity_skipped_update_version');
};
