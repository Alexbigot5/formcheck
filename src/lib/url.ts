import { Channel } from './types';

export function getUrlParam(key: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
}

export function setUrlParam(key: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState({}, '', url.toString());
}

export function getTab(): 'unassigned' | 'mine' | 'all' {
  const tab = getUrlParam('tab');
  if (tab === 'unassigned' || tab === 'mine' || tab === 'all') {
    return tab;
  }
  return 'unassigned';
}

export function setTab(tab: 'unassigned' | 'mine' | 'all'): void {
  setUrlParam('tab', tab);
}

export function getChannel(): 'all' | Channel {
  const channel = getUrlParam('channel');
  if (channel === 'all' || channel === 'email' || channel === 'sms' || channel === 'linkedin' || channel === 'webform') {
    return channel;
  }
  return 'all';
}

export function setChannel(channel: 'all' | Channel): void {
  setUrlParam('channel', channel);
}

export function getQuery(): string {
  return getUrlParam('q') || '';
}

export function setQuery(query: string): void {
  setUrlParam('q', query);
}

export function getConversation(): string | null {
  return getUrlParam('conversation');
}

export function setConversation(conversationId: string | null): void {
  setUrlParam('conversation', conversationId);
}

export function getOwner(): string {
  return getUrlParam('owner') || 'me';
}

export function setOwner(owner: string): void {
  setUrlParam('owner', owner === 'me' ? null : owner);
}
