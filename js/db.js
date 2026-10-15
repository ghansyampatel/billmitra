/* BillMitra — local database (IndexedDB). सारा data phone में, internet के बिना भी. */
(function (root) {
  'use strict';
  const DB_NAME = 'billmitra', DB_VER = 1;
  const STORES = ['settings', 'parties', 'items', 'invoices', 'payments'];
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error('IndexedDB नहीं मिला'));
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return open().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      Promise.resolve(fn(s)).then(v => { out = v; });
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const DB = {
    uid,
    all: store => tx(store, 'readonly', s => req(s.getAll())),
    get: (store, id) => tx(store, 'readonly', s => req(s.get(id))),
    put: (store, obj) => {
      if (!obj.id) obj.id = uid();
      obj.updatedAt = new Date().toISOString();
      return tx(store, 'readwrite', s => req(s.put(obj))).then(() => obj);
    },
    del: (store, id) => tx(store, 'readwrite', s => req(s.delete(id))),
    clear: store => tx(store, 'readwrite', s => req(s.clear())),

    // settings एक ही record: id = 'biz'
    getBiz: () => DB.get('settings', 'biz'),
    saveBiz: b => { b.id = 'biz'; return DB.put('settings', b); },

    // पूरा backup (JSON)
    async exportAll() {
      const out = { app: 'BillMitra', version: 1, exportedAt: new Date().toISOString() };
      for (const s of STORES) out[s] = await DB.all(s);
      return out;
    },
    async importAll(data) {
      if (!data || data.app !== 'BillMitra') throw new Error('यह BillMitra की backup file नहीं है');
      for (const s of STORES) {
        await DB.clear(s);
        for (const o of (data[s] || [])) await tx(s, 'readwrite', st => req(st.put(o)));
      }
    },
    STORES
  };
  root.DB = DB;
})(window);
