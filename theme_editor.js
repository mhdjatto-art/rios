// frontend/theme_editor.js  (Phase 9)
import { DEFAULT_THEME, PRESETS, applyTheme, loadPreferences, savePreferences, themeFromPrefs } from './theme.js';
import { t } from './i18n.js';
import { el, clear, toast, errMsg, field } from './utils.js';

export async function render(host) {
  clear(host);
  host.appendChild(el('h1', { class: 'view-title' }, '🎨 ' + t('theme_editor')));

  const prefs = await loadPreferences();
  let theme = themeFromPrefs(prefs);
  const original = JSON.stringify(theme);

  // Layout: left = controls, right = live preview
  const wrapper = el('div', { class: 'theme-editor' });
  host.appendChild(wrapper);

  const controlsPane = el('div', { class: 'theme-editor__controls' });
  const previewPane = el('div', { class: 'theme-editor__preview' });
  wrapper.append(controlsPane, previewPane);

  renderControls();
  renderPreview();

  function updateLive() {
    applyTheme(theme);
    renderPreview();
  }

  function renderControls() {
    clear(controlsPane);

    // Presets section
    controlsPane.appendChild(el('h3', {}, '🎭 ' + t('preset_themes')));
    const presetGrid = el('div', { class: 'theme-presets' });
    for (const [key, p] of Object.entries(PRESETS)) {
      const btn = el('button', {
        type: 'button',
        class: 'theme-preset-card',
        style: `background: ${p.bg}; color: ${p.text}; border: 2px solid ${p.border}`,
        onclick: () => { theme = { ...p }; delete theme.name; updateLive(); renderControls(); },
      }, [
        el('div', { style: `background: ${p.primary}; height: 20px; border-radius: 4px; margin-bottom: 6px` }),
        el('div', { style: `background: ${p.accent}; height: 10px; border-radius: 3px; margin-bottom: 8px` }),
        el('strong', {}, p.name),
      ]);
      presetGrid.appendChild(btn);
    }
    controlsPane.appendChild(presetGrid);

    // Mode
    controlsPane.appendChild(el('h3', {}, '🌓 ' + t('mode')));
    const modeRow = el('div', { class: 'theme-row' });
    for (const m of ['light', 'dark']) {
      const opt = el('label', { class: 'theme-chip' }, [
        el('input', { type: 'radio', name: 'theme-mode', value: m, checked: theme.mode === m,
          onchange: () => { theme.mode = m; updateLive(); } }),
        el('span', {}, m === 'light' ? '☀️ ' + t('light') : '🌙 ' + t('dark')),
      ]);
      modeRow.appendChild(opt);
    }
    controlsPane.appendChild(modeRow);

    // Colors
    controlsPane.appendChild(el('h3', {}, '🎨 ' + t('colors')));
    const colorKeys = [
      ['primary', t('primary_color')], ['accent', t('accent_color')],
      ['danger', t('danger_color')], ['warning', t('warning_color')],
      ['bg', t('background')], ['surface', t('surface')],
      ['text', t('text_color')], ['muted', t('muted_color')],
      ['border', t('border_color')],
    ];
    const colorGrid = el('div', { class: 'theme-colors' });
    for (const [key, label] of colorKeys) {
      const inp = el('input', { type: 'color', value: theme[key], class: 'theme-color-input',
        oninput: (e) => { theme[key] = e.target.value; updateLive(); } });
      const tx = el('input', { type: 'text', value: theme[key], class: 'input mono', style: 'width:90px',
        onchange: (e) => { theme[key] = e.target.value; updateLive(); } });
      inp.addEventListener('input', () => { tx.value = inp.value; });
      colorGrid.appendChild(el('div', { class: 'theme-color-item' }, [
        el('label', {}, label),
        el('div', { style: 'display:flex; gap:6px' }, [inp, tx]),
      ]));
    }
    controlsPane.appendChild(colorGrid);

    // Font
    controlsPane.appendChild(el('h3', {}, '🔤 ' + t('font')));
    const fontSel = el('select', { class: 'input',
      onchange: (e) => { theme.font = e.target.value; updateLive(); } },
      [
        el('option', { value: 'sf' }, '🍎 SF Pro (Apple)'),
        el('option', { value: 'system' }, 'System'),
        el('option', { value: 'inter' }, 'Inter'),
        el('option', { value: 'cairo' }, 'Cairo (عربي)'),
        el('option', { value: 'tajawal' }, 'Tajawal (عربي)'),
        el('option', { value: 'amiri' }, 'Amiri (عربي كلاسيكي)'),
      ]);
    fontSel.value = theme.font;
    controlsPane.appendChild(fontSel);

    // Radius
    controlsPane.appendChild(el('h3', {}, '⚪ ' + t('radius')));
    const radiusRow = el('div', { class: 'theme-row' });
    for (const r of [0, 4, 6, 8, 12, 16]) {
      const chip = el('button', {
        type: 'button',
        class: 'theme-chip-btn ' + (theme.radius === r ? 'theme-chip-btn--active' : ''),
        style: `border-radius: ${r}px`,
        onclick: () => { theme.radius = r; updateLive(); renderControls(); },
      }, r + 'px');
      radiusRow.appendChild(chip);
    }
    controlsPane.appendChild(radiusRow);

    // Density
    controlsPane.appendChild(el('h3', {}, '📏 ' + t('density')));
    const densityRow = el('div', { class: 'theme-row' });
    for (const d of ['compact', 'comfortable', 'spacious']) {
      const chip = el('button', {
        type: 'button',
        class: 'theme-chip-btn ' + (theme.density === d ? 'theme-chip-btn--active' : ''),
        onclick: () => { theme.density = d; updateLive(); renderControls(); },
      }, t('density_' + d));
      densityRow.appendChild(chip);
    }
    controlsPane.appendChild(densityRow);

    // Shadow
    controlsPane.appendChild(el('h3', {}, '🌫️ ' + t('shadow')));
    const shadowRow = el('div', { class: 'theme-row' });
    for (const s of ['none', 'subtle', 'pronounced']) {
      const chip = el('button', {
        type: 'button',
        class: 'theme-chip-btn ' + (theme.shadow === s ? 'theme-chip-btn--active' : ''),
        onclick: () => { theme.shadow = s; updateLive(); renderControls(); },
      }, t('shadow_' + s));
      shadowRow.appendChild(chip);
    }
    controlsPane.appendChild(shadowRow);

    // Glass toggle
    controlsPane.appendChild(el('h3', {}, '✨ ' + t('glass_effect')));
    const glassToggle = el('label', { class: 'theme-chip' }, [
      el('input', { type: 'checkbox', checked: !!theme.glass,
        onchange: (e) => { theme.glass = e.target.checked; updateLive(); } }),
      el('span', {}, '🪟 ' + t('enable_glass')),
    ]);
    controlsPane.appendChild(glassToggle);

    // Actions
    const saveBtn = el('button', { class: 'btn btn--primary', style: 'flex:1',
      onclick: async () => {
        const newPrefs = { ...prefs, theme };
        const { error } = await savePreferences(newPrefs);
        if (error) return toast(errMsg(error), 'error');
        toast('✅ ' + t('save_changes'), 'success');
      } }, '💾 ' + t('save_changes'));

    const resetBtn = el('button', { class: 'btn btn--ghost',
      onclick: () => {
        if (!confirm(t('reset_confirm'))) return;
        theme = { ...DEFAULT_THEME };
        updateLive(); renderControls();
      } }, '↺ ' + t('reset'));

    const exportBtn = el('button', { class: 'btn btn--ghost',
      onclick: () => {
        const json = JSON.stringify(theme, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'rios-theme.json';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } }, '⬇️ ' + t('export'));

    const importInput = el('input', { type: 'file', accept: '.json', style: 'display:none',
      onchange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const txt = await f.text();
          theme = { ...DEFAULT_THEME, ...JSON.parse(txt) };
          updateLive(); renderControls();
          toast('✓', 'success');
        } catch (err) { toast('Invalid JSON', 'error'); }
      } });
    const importBtn = el('button', { class: 'btn btn--ghost',
      onclick: () => importInput.click() }, '⬆️ ' + t('import'));

    controlsPane.appendChild(el('div', { class: 'form__actions', style: 'margin-top: 20px; border-top: 1px solid var(--rios-border); padding-top: 16px' },
      [saveBtn, resetBtn, exportBtn, importBtn, importInput]));
  }

  function renderPreview() {
    clear(previewPane);
    previewPane.appendChild(el('h3', { style: 'margin-top:0' }, '👁️ ' + t('live_preview')));

    // Mock dashboard
    previewPane.appendChild(el('div', { class: 'kpi-row' }, [
      mockKpi(t('total_sales'), '15,420.00', 'primary'),
      mockKpi(t('total_expenses'), '3,250.00', 'warn'),
      mockKpi(t('net_profit'), '12,170.00', 'success'),
    ]));

    previewPane.appendChild(el('div', { style: 'display:flex; gap: 8px; margin: 16px 0; flex-wrap:wrap' }, [
      el('button', { class: 'btn btn--primary' }, 'Primary'),
      el('button', { class: 'btn btn--ghost' }, 'Ghost'),
      el('button', { class: 'btn btn--danger' }, 'Danger'),
    ]));

    previewPane.appendChild(el('table', { class: 'table' }, [
      el('thead', {}, el('tr', {}, [
        el('th', {}, '#'), el('th', {}, 'Item'), el('th', { class: 'num' }, 'Amount'),
      ])),
      el('tbody', {}, [
        el('tr', {}, [el('td', {}, '001'), el('td', {}, 'منتج تجريبي'), el('td', { class: 'num' }, '120.00')]),
        el('tr', {}, [el('td', {}, '002'), el('td', {}, 'Sample Product'), el('td', { class: 'num' }, '85.50')]),
      ]),
    ]));

    previewPane.appendChild(el('div', { class: 'state state--warn' }, '⚠️ Sample warning'));
    previewPane.appendChild(el('div', { class: 'state state--error' }, '❌ Sample error'));
    previewPane.appendChild(el('div', { class: 'state' }, 'ℹ️ Sample info'));

    previewPane.appendChild(el('div', { class: 'card', style: 'margin-top: 12px' }, [
      el('h3', {}, 'Card heading'),
      el('p', { class: 'muted' }, 'هذا نص تجريبي لمعاينة الثيم. Lorem ipsum dolor sit amet.'),
      el('input', { class: 'input', placeholder: 'Sample input', value: '' }),
    ]));
  }

  function mockKpi(label, value, tone = '') {
    return el('div', { class: `kpi ${tone ? 'kpi--' + tone : ''}` }, [
      el('div', { class: 'kpi__label' }, label),
      el('div', { class: 'kpi__value' }, value),
    ]);
  }
}
