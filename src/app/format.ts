import type { CatalogEndpoint } from '../types';
import { DEFAULT_GATEWAY_PAY_TO } from './config';
import { t } from './i18n';
import { state } from './state';

export function formatRelativeAge(ageSeconds: number | null | undefined): string {
  if (ageSeconds === null || ageSeconds === undefined || ageSeconds < 0) {
    return '-';
  }

  if (ageSeconds < 60) {
    return t('freshness.secondsAgo', { value: ageSeconds });
  }

  if (ageSeconds < 3600) {
    return t('freshness.minutesAgo', { value: Math.floor(ageSeconds / 60) });
  }

  return t('freshness.hoursAgo', { value: Math.floor(ageSeconds / 3600) });
}

export function formatFreshnessStatus(endpoint: CatalogEndpoint): string {
  const status = endpoint.freshness?.status || 'unknown';
  const signal = endpoint.freshness?.signal || 'none';
  const ageLabel = formatRelativeAge(endpoint.freshness?.ageSeconds);
  return `${t(`freshness.${status}`)} · ${ageLabel} · ${t(`freshness.signal.${signal}`)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0%';
  }

  return `${(value * 100).toFixed(1)}%`;
}

export function formatTrendSparkline(endpoint: CatalogEndpoint): string {
  const trend = endpoint.requestMetrics?.requestTrend || [];
  if (trend.length === 0) {
    return '-';
  }

  const values = trend.map((item) => item.requests || 0);
  const max = Math.max(...values, 1);
  const blocks = '▁▂▃▄▅▆▇█';
  return values
    .map((value) => {
      const ratio = value / max;
      const index = Math.min(blocks.length - 1, Math.floor(ratio * (blocks.length - 1)));
      return blocks[index] || blocks[0];
    })
    .join('');
}

export function formatTopError(endpoint: CatalogEndpoint): string {
  const top = endpoint.requestMetrics?.errorsByCode?.[0];
  if (!top) {
    return t('requestMetrics.none');
  }

  return `${top.code} · ${top.count}`;
}

export function getGatewayPayTo(): string {
  return state.catalog?.payment.payTo || DEFAULT_GATEWAY_PAY_TO;
}

export function getGatewayExplorerUrl(address: string): string {
  return `https://basescan.org/address/${address}`;
}

export function getGatewayTxExplorerUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

export function getLocalizedFields(endpoint: CatalogEndpoint) {
  return (
    endpoint.locales?.[state.currentLanguage] ||
    endpoint.locales?.en || {
      label: endpoint.label || endpoint.path.replace('/api/', '').replaceAll('-', ' '),
      category: endpoint.category,
      description: endpoint.description,
    }
  );
}
