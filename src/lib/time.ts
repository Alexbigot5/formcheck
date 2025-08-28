export function formatRelative(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function slaStatus(nowISO: string, slaISO?: string): 'none' | 'ok' | 'soon' | 'overdue' {
  if (!slaISO) return 'none';
  
  const now = new Date(nowISO);
  const sla = new Date(slaISO);
  const diffMs = sla.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 0) {
    return 'overdue';
  } else if (diffMinutes <= 15) {
    return 'soon';
  } else {
    return 'ok';
  }
}
