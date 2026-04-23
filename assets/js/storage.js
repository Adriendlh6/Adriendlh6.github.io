(function(){
  const DB_NAME = 'copilot-boulangerie-db';
  const DB_VERSION = 1;
  const STORES = ['ingredients','fournisseurs','recettes','parametres'];

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex('updatedAt','updatedAt');
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(storeName, mode, action){
    const db = await openDb();
    return new Promise((resolve,reject)=>{
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      try { result = action(store); } catch (err) { reject(err); }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function uid(prefix='id'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

  window.AppDB = {
    async getAll(store){
      const db = await openDb();
      return new Promise((resolve,reject)=>{
        const tr = db.transaction(store,'readonly');
        const req = tr.objectStore(store).getAll();
        req.onsuccess = ()=> resolve(req.result || []);
        req.onerror = ()=> reject(req.error);
      });
    },
    async get(store,id){
      const db = await openDb();
      return new Promise((resolve,reject)=>{
        const tr = db.transaction(store,'readonly');
        const req = tr.objectStore(store).get(id);
        req.onsuccess = ()=> resolve(req.result || null);
        req.onerror = ()=> reject(req.error);
      });
    },
    async put(store, value){
      value.updatedAt = new Date().toISOString();
      if (!value.id) value.id = uid(store.slice(0,3));
      return tx(store,'readwrite', s => s.put(value));
    },
    async delete(store, id){
      return tx(store,'readwrite', s => s.delete(id));
    },
    async clear(store){
      return tx(store,'readwrite', s => s.clear());
    },
    async exportAll(){
      const payload = {};
      for (const s of STORES) payload[s] = await this.getAll(s);
      return payload;
    },
    async importAll(payload){
      for (const s of STORES){
        await this.clear(s);
        for (const row of (payload[s] || [])) await this.put(s,row);
      }
    },
    stores: STORES
  };
})();
