(function (root) {
  'use strict';
  const key = 'cc_boat_photos_v1';
  let boats = {};
  try { boats = JSON.parse(localStorage.getItem(key) || '{}'); }
  catch (err) { console.error('Could not load boat photo selections.', err); }

  function get(boatId) { return boats[boatId]; }

  function save(boatId, photos, selected) {
    boats[boatId] = { photos, selected };
    localStorage.setItem(key, JSON.stringify(boats));
    root.dispatchEvent(new CustomEvent('boat-photos-updated'));
  }

  function choose(boatId, selected) {
    const entry = get(boatId);
    if (!entry || (selected && !entry.photos.some(photo => photo.url === selected))) {
      throw new Error('Choose a photo from this boat\'s folder.');
    }
    save(boatId, entry.photos, selected);
  }

  async function discover(file, boatId) {
    const response = await fetch(`/api/boat-photos?name=${encodeURIComponent(file.name)}&size=${file.size}`);
    if (!(response.headers.get('content-type') || '').includes('application/json')) {
      throw new Error('Local photo discovery requires local_server.py. Restart using ensure_local_server.py.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Local photo discovery failed.');
    if (!result.photos.length) throw new Error('No JPG, PNG or WebP photos found beside this PDF or in its subfolders.');
    const existing = get(boatId)?.selected;
    const selected = result.photos.some(photo => photo.url === existing) ? existing : result.selected;
    save(boatId, result.photos, selected);
    return selected ? '' : 'Nearby photos found. Choose an exterior hull photo using the selector on the top model card.';
  }

  root.BOAT_PHOTOS = { get, choose, discover };
})(window);
