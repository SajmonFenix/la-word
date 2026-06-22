const COLORS = [
  '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6',
  '#E91E63', '#00BCD4', '#FF9800', '#795548', '#607D8B'
];

let editingId = null;
let _searchActive = false;

function openSearch() {
  _searchActive = true;
  document.getElementById('header-actions').classList.add('hidden');
  document.getElementById('search-bar').classList.remove('hidden');
  document.getElementById('search-input').value = '';
  document.getElementById('search-feedback').classList.add('hidden');
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

function closeSearch() {
  _searchActive = false;
  document.getElementById('header-actions').classList.remove('hidden');
  document.getElementById('search-bar').classList.add('hidden');
  document.getElementById('search-feedback').classList.add('hidden');
}

function handleSearch() {
  const query = document.getElementById('search-input').value;
  const fb = document.getElementById('search-feedback');

  if (!query.trim()) {
    fb.textContent = 'Zadaj hľadaný výraz';
    fb.classList.remove('hidden');
    return;
  }

  const result = ui.search(query);

  if (result === null) {
    fb.textContent = 'Žiadna karta nevyhovuje hľadaniu';
    fb.classList.remove('hidden');
  } else {
    fb.textContent = `Nájdená karta ${result + 1} / ${cards.getAll().length}`;
    fb.classList.remove('hidden');
    setTimeout(() => fb.classList.add('hidden'), 2000);
    closeSearch();
  }
}

async function init() {
  await cards.init();
  ui.onEditCard = (cardData) => openAddModal(cardData);
  ui.init();
  bindEvents();
}

function bindEvents() {
  document.getElementById('btn-add').addEventListener('click', openAddModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('card-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-delete').addEventListener('click', handleDelete);
  document.getElementById('btn-translate').addEventListener('click', handleTranslate);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-settings-close').addEventListener('click', closeSettings);
  document.getElementById('btn-export').addEventListener('click', handleExport);
  document.getElementById('btn-import').addEventListener('click', handleImport);
  document.getElementById('settings-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.addEventListener('cards-change', () => {
    ui.refresh();
  });
  document.getElementById('toggle-arrows').addEventListener('change', (e) => {
    ui.toggleArrows(e.target.checked);
  });
  document.getElementById('btn-search').addEventListener('click', openSearch);
  document.getElementById('btn-search-close').addEventListener('click', closeSearch);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') closeSearch();
  });
}

function openAddModal(cardData) {
  editingId = cardData?.id || null;
  const isEdit = !!editingId;
  document.getElementById('modal-title').textContent = isEdit ? 'Upraviť kartu' : 'Nová karta';
  document.getElementById('btn-save').textContent = isEdit ? 'Uložiť' : 'Pridať';
  document.getElementById('btn-delete').classList.toggle('hidden', !isEdit);
  document.getElementById('input-front').value = cardData?.front || '';
  document.getElementById('input-hint').value = cardData?.hint || '';
  document.getElementById('input-back').value = cardData?.back || '';
  renderColorPicker(cardData?.color || COLORS[Math.floor(Math.random() * COLORS.length)]);
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('input-front').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

function renderColorPicker(selected) {
  const container = document.getElementById('color-picker');
  container.innerHTML = COLORS.map(c =>
    `<div class="color-option ${c === selected ? 'selected' : ''}"
          style="background: ${c}"
          data-color="${c}"></div>`
  ).join('');

  container.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

function getSelectedColor() {
  const selected = document.querySelector('#color-picker .color-option.selected');
  return selected ? selected.dataset.color : COLORS[0];
}

function handleFormSubmit(e) {
  e.preventDefault();
  const front = document.getElementById('input-front').value.trim();
  const hint = document.getElementById('input-hint').value.trim();
  const back = document.getElementById('input-back').value.trim();
  const color = getSelectedColor();

  if (!front || !back) return;

  if (editingId) {
    cards.update(editingId, { front, hint, back, color });
  } else {
    const newCard = cards.add({ front, hint, back, color });
    closeModal();
    ui.refresh();
    ui.showCard(newCard.id);
    return;
  }

  closeModal();
  ui.refresh();
}

function handleDelete() {
  if (!editingId) return;
  if (!confirm('Naozaj chceš vymazať túto kartu?')) return;
  cards.delete(editingId);
  closeModal();
  ui.refresh();
}

async function handleTranslate() {
  const front = document.getElementById('input-front').value.trim();
  const backInput = document.getElementById('input-back');
  const translateBtn = document.getElementById('btn-translate');

  if (!front) {
    document.getElementById('input-front').focus();
    return;
  }

  if (backInput.value.trim()) {
    backInput.value = '';
    return;
  }

  translateBtn.textContent = '...';
  translateBtn.disabled = true;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(front)}&langpair=sk|en`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseData?.translatedText) {
      backInput.value = data.responseData.translatedText;
    }
  } catch {
    // silent fail
  } finally {
    translateBtn.textContent = '🌐';
    translateBtn.disabled = false;
  }
}

function openSettings() {
  document.getElementById('toggle-arrows').checked = ui._showArrows;
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}

function handleExport() {
  const json = storage.exportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'la-word-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      await storage.importData(text);
                    await cards.init();
                    ui.init();
      closeSettings();
      alert('Karty boli úspešne importované.');
    } catch {
      alert('Chyba: neplatný súbor.');
    }
  };
  input.click();
}

document.addEventListener('DOMContentLoaded', init);
