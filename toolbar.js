// frontend/toolbar.js (Phase 21) — Priority-grouped toolbar helper
import { el } from './utils.js';

export function buildToolbar({ title, primary = [], secondary = [], more = [], filters = [] } = {}) {
  const bar = el('div', { class: 'toolbar--grouped' });

  if (title) {
    bar.appendChild(el('h1', { class: 'view-title', style: 'margin:0 12px 0 0; font-size:18px' }, title));
  }

  if (filters.length) {
    const filterGroup = el('div', { class: 'toolbar__group', style: 'padding:0; background:transparent' });
    for (const f of filters) filterGroup.appendChild(f);
    bar.appendChild(filterGroup);
  }

  for (const group of secondary) {
    if (!group.items || !group.items.length) continue;
    const grp = el('div', { class: 'toolbar__group' });
    for (const it of group.items) {
      const btn = el('button', {
        class: 'btn' + (it.type ? ' btn--' + it.type : ''),
        onclick: it.onclick,
        title: it.tooltip || it.label,
      }, [
        it.icon ? el('span', {}, it.icon + ' ') : '',
        it.label,
      ].filter(Boolean));
      grp.appendChild(btn);
    }
    bar.appendChild(grp);
  }

  const priorityBox = el('div', { class: 'toolbar__priority' });
  for (const a of primary) {
    priorityBox.appendChild(el('button', {
      class: 'btn btn--' + (a.type || 'primary'),
      onclick: a.onclick,
      title: a.tooltip || a.label,
    }, [
      a.icon ? el('span', {}, a.icon + ' ') : '',
      a.label,
    ].filter(Boolean)));
  }

  if (more.length) {
    const moreWrap = el('div', { class: 'toolbar__more' });
    const moreMenu = el('div', { class: 'toolbar__more-menu' });
    for (const a of more) {
      moreMenu.appendChild(el('button', {
        onclick: () => {
          moreWrap.classList.remove('open');
          a.onclick?.();
        },
      }, [
        a.icon ? el('span', {}, a.icon + ' ') : '',
        a.label,
      ].filter(Boolean)));
    }
    const moreBtn = el('button', {
      class: 'btn btn--ghost',
      onclick: (e) => {
        e.stopPropagation();
        moreWrap.classList.toggle('open');
      },
    }, '⋯ More');
    moreWrap.append(moreBtn, moreMenu);
    priorityBox.appendChild(moreWrap);

    document.addEventListener('click', (e) => {
      if (!moreWrap.contains(e.target)) moreWrap.classList.remove('open');
    });
  }

  if (primary.length || more.length) bar.appendChild(priorityBox);

  return bar;
}

export function statCard({ label, value, change, tone }) {
  const card = el('div', { class: 'stat-card' + (tone ? ' stat-card--' + tone : '') });
  card.appendChild(el('div', { class: 'stat-card__label' }, label));
  card.appendChild(el('div', { class: 'stat-card__value' }, String(value)));
  if (change != null) {
    const cls = change >= 0 ? 'stat-card__change--up' : 'stat-card__change--down';
    const arrow = change >= 0 ? '↑' : '↓';
    card.appendChild(el('div', { class: 'stat-card__change ' + cls },
      `${arrow} ${Math.abs(change)}%`));
  }
  return card;
}

export function modernPill(text, tone = '') {
  return el('span', { class: 'pill--modern' + (tone ? ' pill--' + tone : '') }, text);
}

export function searchInput(placeholder, onInput) {
  const wrap = el('div', { class: 'search-input' });
  const input = el('input', {
    type: 'search',
    class: 'input',
    placeholder: placeholder || 'Search...',
    oninput: (e) => onInput?.(e.target.value),
  });
  wrap.appendChild(input);
  return { wrap, input };
}

export function emptyState({ icon = '📭', title = 'Nothing here', subtitle = '' } = {}) {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-state__icon' }, icon),
    el('div', { class: 'empty-state__title' }, title),
    subtitle ? el('div', { class: 'empty-state__subtitle' }, subtitle) : '',
  ].filter(Boolean));
}
